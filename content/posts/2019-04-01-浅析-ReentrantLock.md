---
title: "浅析 ReentrantLock"
date: 2019-04-01
slug: "浅析-ReentrantLock"
tags: ["Java"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/reentrantLock.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/nonfairLock_lock("
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 可重入锁简介](#可重入锁简介)
3.  [3. ReentrantLock 处理死锁的手段](#ReentrantLock-处理死锁的手段)
    1.  [3.1. 中断响应](#中断响应)
    2.  [3.2. 锁申请等待限时](#锁申请等待限时)
4.  [4. ReetrantLock中的公平锁与非公平锁](#ReetrantLock中的公平锁与非公平锁)
5.  [5. 可重入锁的内部实现](#可重入锁的内部实现)
    1.  [5.1. AQS 简介](#AQS-简介)
    2.  [5.2. 非公平锁下的lock方法浅析](#非公平锁下的lock方法浅析)
    3.  [5.3. 非公平锁的unlock方法浅析](#非公平锁的unlock方法浅析)
6.  [6. 参考链接 & 鸣谢](#参考链接-amp-鸣谢)

## 前言

下面将从以下几个方面浅析ReentrantLock：

*   ReetrantLock可重入锁简介
*   ReetrantLock的特性
    *   中断响应
    *   锁申请等待限时
*   ReentrantLock中的公平锁与非公平锁
*   ReetrantLock的内部实现

## 可重入锁简介

重入锁 ReentrantLock，顾名思义，就是支持重进入的锁，它表示该锁能够支持一个线程对资源的重复加锁。代码示例如下：  

```java
public class ReenterLock implements Runnable{
    private ReentrantLock lock = new ReentrantLock();
    private int i = 0;
    @Override
    public void run() {
        for (int j = 0; j < 1000000 ; j++) {
            //获取锁
            lock.lock();
            try{
                i++;
            } finally {
                //释放锁
                lock.unlock();
            }
        }
    }

    public static void main(String[] args) throws InterruptedException {
        ReenterLock reenterLock = new ReenterLock();
        Thread t1 = new Thread(reenterLock);
        Thread t2 = new Thread(reenterLock);
        t1.start();
        t2.start();
        t1.join();
        t2.join();
        System.out.println(reenterLock.i);
    }
}
```

重进入是指任意线程在获取到锁之后能够再次获取该锁而不会被锁所阻塞：

*   **线程的再次获取锁**。锁需要去识别**获取锁的线程是否为当前占据锁的线程**，如果是，则再次成功获取
*   **锁的最终释放**。**线程重复n次 获取了锁，随后在第 n 次释放该 锁，其他线程能够获取到该锁**。锁的最终释放要求锁对于获取进行计数自增，计数表示当前锁被重复获取的次数，而锁被释放，计数自减，当计数等于0时表示锁已经成功释放。

代码示例如下：  

```java
lock.lock();
lock.lock();
try{
    i++;
} finally {
    //释放锁
    lock.unlock();
    lock.unlock();
}
```

## ReentrantLock 处理死锁的手段

> ReentrantLock处理死锁的手段，说白了也是ReentrantLock的重要特性

首先介绍下死锁的大致概念：

> 两个或多个进程在执行过程中，因争夺资源而造成的一种相互等待的现象，如无外力作用，它们将无法继续进行下去

下面举一个 Synchronized下的死锁例子：  

```java
public class DeadLockExample implements Runnable{
    private boolean flag;
    //锁1
    private static Object lock1 = new Object();
    //锁2
    private static Object lock2 = new Object();

    public DeadLockExample(boolean flag) {
        this.flag = flag;
    }

    @Override
    public void run() {
        if (flag) {
            synchronized (lock1) {
                System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock1");
                try {
                    TimeUnit.SECONDS.sleep(2);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                //尝试获取lock2
                System.out.println("线程 :  "+ Thread.currentThread().getName()+" waiting get lock2");
                synchronized (lock2) {
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock1");
                }
            }
        } else {
            synchronized (lock2) {
                System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock2");
                try {
                    TimeUnit.SECONDS.sleep(2);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                //尝试获取锁1
                System.out.println("线程 :  "+ Thread.currentThread().getName()+" waiting get lock1");
                synchronized (lock1) {
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock1");
                }
            }
        }
    }

    public static void main(String[] args) {
        Thread t1 = new Thread(new DeadLockExample(true));
        t1.setName("A");
        Thread t2 = new Thread(new DeadLockExample(false));
        t2.setName("B");
        t1.start();
        t2.start();
    }
}
```

输出结果：  

```
线程 ： A get lock1
线程 ： B get lock2
线程 :  A waiting get lock2
线程 :  B waiting get lock1
```

可以看出线程 A在等待获取锁2，而线程 B在等待获取锁1，两个线程相互等待这样就形成了死锁

而ReentranLock 与 Synchronized 一样是一种同步机制，但是 ReentranLock 提供了 比 synchronized 更强大、更灵活的锁机制，**可以减少死锁发生的概率**。

ReentranLock 提供了两种方式来处理死锁：

*   中断响应
*   锁申请等待限时

### 中断响应

使用 lock的 `lockInteruptibly()`方法获取锁，如果出现死锁的话，调用线程的 interrupt来消除死锁，以上面那个例子为基础，改成 ReentrantLock的形式，代码如下  

```java
public class DeadLockWithReentrantLock implements Runnable{
    private boolean flag;
    //锁1
    private static ReentrantLock lock1 = new ReentrantLock();
    //锁2
    private static ReentrantLock lock2 = new ReentrantLock();

    public DeadLockWithReentrantLock(boolean flag) {
        this.flag = flag;
    }

    @Override
    public void run() {
        try {
            if (flag) {
                //获取锁
                lock1.lockInterruptibly();
                System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock1");
                TimeUnit.SECONDS.sleep(2);
                System.out.println("线程 ： " + Thread.currentThread().getName() + " try to get lock2");
                lock2.lockInterruptibly();
            } else {
                lock2.lockInterruptibly();
                System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock2");
                TimeUnit.SECONDS.sleep(2);
                System.out.println("线程 ： " + Thread.currentThread().getName() + " try to get lock1");
                lock1.lockInterruptibly();
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            //如果当前线程持有锁1,释放锁1
            if (lock1.isHeldByCurrentThread()) {
                lock1.unlock();
            }
            //如果当前线程持有锁2,释放锁2
            if (lock2.isHeldByCurrentThread()) {
                lock2.unlock();
            }
            System.out.println("线程 ： " + Thread.currentThread().getName() + " 退出");
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(new DeadLockWithReentrantLock(true));
        t1.setName("A");
        Thread t2 = new Thread(new DeadLockWithReentrantLock(false));
        t2.setName("B");
        t1.start();
        t2.start();
        TimeUnit.SECONDS.sleep(5);
        System.out.println("线程B设置中断标记，线程B将退出死锁状态");
        t2.interrupt();

    }
}
```

输出结果  

```
线程 ： A get lock1
线程 ： B get lock2
线程 ： B try to get lock1
线程 ： A try to get lock2
线程B设置中断标记，线程B将退出死锁状态
java.lang.InterruptedException
线程 ： B 退出
线程 ： A 退出
	at java.util.concurrent.locks.AbstractQueuedSynchronizer.doAcquireInterruptibly(AbstractQueuedSynchronizer.java:898)
	at java.util.concurrent.locks.AbstractQueuedSynchronizer.acquireInterruptibly(AbstractQueuedSynchronizer.java:1222)
	at java.util.concurrent.locks.ReentrantLock.lockInterruptibly(ReentrantLock.java:335)
	at com.pjmike.thread.reentrantlock.DeadLockWithReentrantLock.run(DeadLockWithReentrantLock.java:36)
	at java.lang.Thread.run(Thread.java:745)
```

线程A获取锁1，线程B获取锁2，线程A尝试获取锁2，线程B尝试获取锁1，两个线程相互等待对方持有的锁，故形成了死锁。此时 main函数中，调用线程B的`interrupt` 中断线程，线程B响应中断，最后两个线程都相继退出。真正完成任务只有线程A,线程B首先响应中断，放弃任务直接退出，释放资源。

下面来看下关键方法 `lockInterruptibly`是如何实现的：  

```java
public void lockInterruptibly() throws InterruptedException {
    sync.acquireInterruptibly(1);
}
```

方法中调用队列同步器`AbstractQueuedSynchronizer`中的`acquireInterruptibly`方法  

```java
public final void acquireInterruptibly(int arg)
        throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException();
    if (!tryAcquire(arg))
        doAcquireInterruptibly(arg);
}
```

从上面的代码就可以看出如果当前线程被中断，就会抛出一个 `InterruptedException`异常，我们之前的输出结果也是抛出一个中断异常，最终死锁被消除。关于队列同步器的部分，这里就不详细介绍了，可以参阅《Java并发编程的艺术》一书，书中对AQS的描述如下:

> AQS 是用来构建锁或者其他同步组件的基础框架，它使用了一个 int成员变量表示同步状态，通过内置的FIFO 队列来完成资源获取线程的排队工作。

### 锁申请等待限时

除了等待外部中断外，避免死锁还有一种方法就是限时等待。限时等待的方式是调用 `tryLock`方法，还是先来看代码示例如下：  

```java
public class DeadLockWithReentrantLock2 implements Runnable{
    private boolean flag;
    //锁1
    private static ReentrantLock lock1 = new ReentrantLock();
    //锁2
    private static ReentrantLock lock2 = new ReentrantLock();

    public DeadLockWithReentrantLock2(boolean flag) {
        this.flag = flag;
    }

    @Override
    public void run() {
        try {
            if (flag) {
                    if (lock1.tryLock()) {
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock1");
                    TimeUnit.SECONDS.sleep(2);
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " try to get lock2");
                    if (lock2.tryLock()) {
                        System.out.println("线程 ： " + Thread.currentThread().getName() + " already get lock2");
                    }
                }
            } else {
                if (lock2.tryLock()) {
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " get lock2");
                    TimeUnit.SECONDS.sleep(2);
                    System.out.println("线程 ： " + Thread.currentThread().getName() + " try to get lock1");
                    if (lock1.tryLock()) {
                        System.out.println("线程 ： " + Thread.currentThread().getName() + " already get lock1");
                    }
                }
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            //如果当前线程持有锁1,释放锁1
            if (lock1.isHeldByCurrentThread()) {
                lock1.unlock();
            }
            //如果当前线程持有锁2,释放锁2
            if (lock2.isHeldByCurrentThread()) {
                lock2.unlock();
            }
            System.out.println("线程 ： " + Thread.currentThread().getName() + " 退出");
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(new DeadLockWithReentrantLock2(true));
        t1.setName("A");
        Thread t2 = new Thread(new DeadLockWithReentrantLock2(false));
        t2.setName("B");
        t1.start();
        t2.start();
        TimeUnit.SECONDS.sleep(5);
    }
}
```

输出结果是：  

```
线程 ： B get lock2
线程 ： A get lock1
线程 ： B try to get lock1
线程 ： A try to get lock2
线程 ： B 退出
线程 ： A already get lock2
线程 ： A 退出
```

ReentrantLock.tryLock()方法不带参数运行的情况下，当前线程会尝试获取锁，如果锁并未被其他线程占用，则申请锁会成功，并立即返回true。如果锁被其他线程占用，则当前线程不会进行等待，而是立即返回 false.这种模式不会引起线程等待，因此也不会产生死锁。

上面的例子中，线程A获得锁1，线程B获得锁2，线程B尝试获取锁1，发现锁1被占用，此时线程B不会等待，最终退出释放锁2，线程A就获得锁2继续执行任务而后退出。

其实，tryLock方法还可以接受两个参数，一个表示等待时长，另外一个表示计时单位。  

```
public boolean tryLock(long timeout, TimeUnit unit)
```

比如设置时长为5s，就表示线程在锁请求中，最多等待5s，如果超过5s没有获得锁，就会返回 false.如果成功获得锁，则返回true.

## ReetrantLock中的公平锁与非公平锁

ReentrantLock中有两种锁：公平锁和非公平锁。

*   公平锁： 按照时间顺序，先来先获取锁，也就是FIFO，维护一个有序队列
*   非公平锁： 请求获取锁的顺序是随机的，不是公平的，可能一个请求多次获得锁，一个请求一次锁也获得不了

默认情况下，ReentrantLock获得的锁是非公平的。上面举的一些代码示例中获得锁都是非公平的。当然也可以设置公平锁，在ReentrantLock的构造方法里  

```java
public ReentrantLock(boolean fair)
```

但是公平锁需要系统维护一个有序队列，因此公平锁的实现成本比较高，性能也比较低下。下面来举一个公平锁的代码示例：  

```java
public class FairLock implements Runnable{
    private static ReentrantLock lock = new ReentrantLock(true);
    @Override
    public void run() {
        while (true) {
            try {
                lock.lock();
                System.out.println(Thread.currentThread().getName() + " 获得锁 ");
            } finally {
                lock.unlock();
            }
        }
    }

    public static void main(String[] args) {
        FairLock fairLock = new FairLock();
        Thread A = new Thread(fairLock, "Thread-A");
        Thread B = new Thread(fairLock, "Thread-B");
        A.start();
        B.start();
    }
}
```

输出结果：  

```
Thread-A 获得锁 
Thread-B 获得锁 
Thread-A 获得锁 
Thread-B 获得锁 
Thread-A 获得锁 
Thread-B 获得锁 
Thread-A 获得锁 
Thread-B 获得锁 
......
```

从输出结果看，两个线程基本上是交替获得锁的，几乎不会发生同一线程连续多次获得锁的可能，从而保证了公平性。

再次总结下公平锁与非公平锁：

*   **公平锁保证了锁的获取按照FIFO原则，而代价是进行大量的线程切换**
*   **非公平锁虽然可能造成线程”饥饿”,但极少的线程切换，保证了其更大的吞吐量**

## 可重入锁的内部实现

ReentrantLock的类层次结构如下图所示：

_\[配图已丢失: reentrantLock.png\]_

ReentrantLock实现了Lock接口，Lock接口定义了锁获取和释放的基本操作：  

```java
public interface Lock {
    //获取锁
    void lock();
    //可中断地获取锁，在锁的获取时可以中断当前线程
    void lockInterruptibly() throws InterruptedException;
    //非阻塞的获取锁，调用该方法后立刻返回，如果能够获取返回true，否则返回false
    boolean tryLock();
    //获取锁的超时设定
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;
    //释放锁
    void unlock();
    //获取等待通知组件
    Condition newCondition();
}
```

从上图还可以看出，ReentrantLock内部有三个内部类：Sync、NonfairSync、FairSync。Sync是一个抽象类型，它继承了AbstractQueuedSynchronizer(简称AQS)，而NonfairSync和FairSync是Sync的继承类，分别对应非公平锁和公平锁。AQS是队列同步器，是用来构建锁或者其他同步组件的基础框架，实现了很多与锁相关的功能。

### AQS 简介

AQS的主要使用方式是继承，子类通过继承AQS并实现它的抽象方法来管理同步状态。而Sync也是继承AQS，实现了它的tryRelease方法。

在抽象方法的实现过程中免不了要对同步状态进行更改，这时就需要使用AQS提供的三个方法:

*   getState(): 获取当前同步状态
    
*   setState(int newState): 设置当前同步状态
    
*   compareAndSetState(int expect，int update): 使用CAS设置当前状态，该方法能够保证状态设置的原子性。（**CAS是一种用于在多线程环境下实现同步功能的机制，CAS操作包含三个操作数–内存位置、预期数值和新值。CAS的实现逻辑是将内存位置处的数值与预期数值相比较、若相等，则将内存位置处的值替换为新值，若不相等，则不做任何操作**）
    

同步器依赖内部的同步队列(一个FIFO双向队列，也叫做CLH同步队列)来完成同步状态的管理，当前线程获取获取同步状态失败时，AQS则会将当前线程以及等待状态等信息构造成一个节点(Node)并将其加入CLH同步队列，同时会阻塞当前线程，当同步状态释放时，会把首节点中的线程唤醒，使其再次尝试获取同步状态。

最后再简单介绍AQS中的几个方法以方便后面分析使用，（AQS是一门大学问，可以说在Java并发是非常核心的内容，本文只做简单介绍，对于AQS更详细内容请参阅相关书籍）：

*   boolean tryAcquire(int arg): 独占式获取同步状态，实现该方法需要查询当前状态并判断同步状态是否符合预期，然后再进行CAS设置同步状态
    
*   boolean tryRelease(int arg): 独占式释放同步状态，等待获取同步状态的线程将有机会获取同步状态
    
*   boolean release(int arg): 释放同步状态，并将CLH同步队列中第一个节点包含的线程唤醒
    
*   void acquire(int arg): 获取同步状态，如果当前线程获取同步状态成功，则由该方法返回，否则，将会进入同步队列等待，该方法将会调用重写的tryAcquire(int arg)方法。
    

下面通过源码的形式，以非公平锁为例，简要分析lock方法与unlock的内部实现。

### 非公平锁下的lock方法浅析

以下面这个demo的核心代码来分析：  

```java
private ReentrantLock lock = new ReentrantLock();
private int i = 0;
@Override
public void run() {
    //获取锁
    lock.lock();
    try {
        i++;
    } finally {
        //释放锁
        lock.unlock();
    }
}
```

1.  默认情况下，ReentrantLock使用非公平锁，也就是NonfairSync，上述代码中`lock.lock()`实际调用的是NonfairSync的lock方法，lock内部首先执行compareAndSetState 方法进行CAS操作，尝试抢占锁，如果成功，就调用`setExclusiveOwnerThread`方法把当前线程设置在这个锁上，表示抢占成功。
    
    ```java
    static final class NonfairSync extends Sync {
            ...
         final void lock() {
                //调用AQS的compareAndSetState方法进行CAS操作
                //当同步状态为0时，获取锁，并设置状态为1
                if (compareAndSetState(0, 1))
                    setExclusiveOwnerThread(Thread.currentThread());
                else
                    acquire(1);
            }
            ...
    }
    ```
    
2.  如果锁被其他线程抢占，即失败，则调用acquire(1)方法, 该方法是AQS提供的模板方法，总体原理是先去抢占锁，如果没有抢占成功，就在CLH队列中增加一个的当前线程的节点，表示等待后续抢占。
    
    ```java
    public final void acquire(int arg) {
        if (!tryAcquire(arg) &&
            acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
            selfInterrupt();
    }
    ```
    
3.  进入acquire方法，先调用tryAcquire，实则调用的是NonfairSync中的实现，然后再次跳转到nonfairTryAcquire方法上。
    
    ```java
    // 1
    protected final boolean tryAcquire(int acquires) {
        return nonfairTryAcquire(acquires);
    }
    // 2
    final boolean nonfairTryAcquire(int acquires) {
        //当前线程
        final Thread current = Thread.currentThread();
        int c = getState();
        //比较当前同步状态是否为0，如果是0，就去抢占锁
        if (c == 0) {
            if (compareAndSetState(0, acquires)) {
                setExclusiveOwnerThread(current);
                return true;
            }
        }
        //如果不为0，就比较当前线程与占用锁的线程是不是同一个线程，如果是，就去增加状态变量的值
        //这就是可重入锁之所以能可重入，就是因为同一个线程可以反复使用它的锁
        else if (current == getExclusiveOwnerThread()) {
            int nextc = c + acquires;
            if (nextc < 0) // overflow
                throw new Error("Maximum lock count exceeded");
            setState(nextc);
            return true;
        }
        return false;
    }
    ```
    
4.  如果tryAcquire返回false，就进入acquireQueued方法向CLH同步队列增加一个当前线程的节点，等待抢占，关于其中的细节，这里点到为止，不细说了。
    

下图是NonfairSync的lock方法的一个调用时序图，与上面的分析相呼应：

_\[配图已丢失: nonfairLock\_lock\_\]_

.png)

### 非公平锁的unlock方法浅析

unlock调用过程源代码如下：  

```java
//1 ReentrantLock中的unlock
public void unlock() {
    sync.release(1); //调用Sync的release方法，实则调用AQS中的release
}
//2 AQS中的release
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}

//3  在release中调用 Sync实现的tryRelease方法
protected final boolean tryRelease(int releases) {
    //getState()=1，前面获取锁时已经更新为1，而releases为1，=> c =0
    int c = getState() - releases; 
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    //去除锁的独占线程
    if (c == 0) {
        free = true;
        setExclusiveOwnerThread(null);
    }
    //重新设置state = 0
    setState(c);
    //释放锁成功返回true
    return free;
}
```

1.  调用ReentrantLock中的unlock，实则直接调用AQS的release操作
2.  进入release方法，内部调用tryRelease方法（Sync类已重写该方法），去除锁的独占线程，也就是释放锁
3.  tryRelease内部实现是首先获取同步状态，然后将状态减1，这里减一主要是考虑到可重入锁可能自身会多次占用锁，只有当同步状态变成0时，才表示完全释放了锁。
4.  一旦tryRelease释放锁成功，将CLH同步队列中第一个节点包含的线程唤醒。

## 参考链接 & 鸣谢

*   [实战Java高并发程序设计](https://book.douban.com/subject/26663605/)
*   [Java并发编程的艺术](https://book.douban.com/subject/26591326/)
*   [Java可重入锁原理](http://blog.jobbole.com/108571/)
