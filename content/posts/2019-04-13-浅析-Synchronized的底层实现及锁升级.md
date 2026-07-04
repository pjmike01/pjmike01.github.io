---
title: "浅析 Synchronized的底层实现及锁升级"
date: 2019-04-13
slug: "浅析-Synchronized的底层实现及锁升级"
tags: ["Java"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/ObjectHead-1024x329.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E7%AE%A1%E7%A8%8B%E7%9A%84%E7%BB%93%E6%9E%84.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/Java%20Monitor.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/monitor.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. synchronized的实现原理](#synchronized的实现原理)
    1.  [2.1. 同步代码块](#同步代码块)
    2.  [2.2. 同步方法](#同步方法)
    3.  [2.3. 对象头](#对象头)
    4.  [2.4. Moniter](#Moniter)
        1.  [2.4.1. 操作系统中的管程](#操作系统中的管程)
        2.  [2.4.2. Java的管程Monitor](#Java的管程Monitor)
3.  [3. synchronized的锁升级](#synchronized的锁升级)
    1.  [3.1. 偏向锁](#偏向锁)
    2.  [3.2. 轻量级锁](#轻量级锁)
    3.  [3.3. 重量级锁](#重量级锁)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

本文主要从Synchronzied的以下两个方面进行浅析：

*   Synchronized的底层实现（对于同步代码块与同步方法）
*   Synchronized的锁升级

## synchronized的实现原理

首先来看一下对于同步代码块，synchronized的底层实现到底是怎样的

### 同步代码块

给定下面源代码：  

```
public void test2() {
    synchronized (this) {

    }
}
```

使用javap生成的class文件部分信息如下：  

```
public void test2();
descriptor: ()V
flags: ACC_PUBLIC
Code:
  stack=2, locals=3, args_size=1
     0: aload_0
     1: dup
     2: astore_1
     3: monitorenter
     4: aload_1
     5: monitorexit
     6: goto          14
     9: astore_2
    10: aload_1
    11: monitorexit
    12: aload_2
    13: athrow
    14: return
```

从上面的信息可以看出，同步代码块使用了monitorenter和monitorexit指令来实现的，monitorenter指令插入到同步代码块的开始位置，monitorexit指令插入到同步代码块的结束位置，JVM需要保证每一个monitorenter都有一个monitorexit与之相对应。任何对象都有一个monitor与之相关联，当且一个monitor被持有之后，他将处于锁定状态。线程执行到monitorenter指令时，将会尝试获取对象所对应的monitor所有权，即尝试获取对象的锁。

有读者可能会疑问，为什么有两个monitorexit？实际上是为了保证在方法异常完成时monitorenter和monitorexit指令依然可以正确配对执行，最后一个moniterexit那里是异常处理逻辑，编译器会自动产生一个异常处理器，这个异常处理器声明可处理所有的异常，它的目的就是用来执行monitexit指令

至于提到的monitor，后文会详细分析，这里只要记住每个对象有一个moniter与之关联，moniter可以看做是监视器锁

### 同步方法

下面是同步方法的源代码：  

```
public synchronized void test1() {

}
```

反编译后的class文件信息：  

```
public synchronized void test1();
descriptor: ()V
flags: ACC_PUBLIC, ACC_SYNCHRONIZED
Code:
  stack=0, locals=1, args_size=1
     0: return
  LineNumberTable:
    line 11: 0
```

从上面信息可以看到同步方法的class文件信息中并没有monitorenter和monitorexit字节码指令，同步方法的底层实现与同步代码块是有区别的。

> 以下分析参考《深入理解Java虚拟机》

仔细看，我们会发现一个关键点 `ACC_SYNCHRONIZED`，这看上去与synchronized有某种联系，实际上，对于同步方法来说，它依靠的是方法修饰符上的ACC\_SYNCHRONIZED，它不是通过字节码指令来控制，而是在方法调用和返回操作之中，jvm从方法常量池的方法表结构中的ACC\_SYNCHRONIZED方法标志得知一个方法是否声明为同步方法。

当方法调用时，调用指令将会检查方法的ACC\_SYNCHRONIZED访问标志是否被设置，如果设置了，执行线程就要求先成功持有Minotor，然后才能执行方法，最后当方法完成（无论正常完成还是非正常完成）时释放Minoter，在方法执行期间，执行线程持有了Minoter，其他任何线程都无法再获取到同一个Minoter，如果一个同步方法执行期间抛出了异常，并且在方法内部无法处理此异常，那么这个同步方法所持有的管程将在异常抛到同步方法之外时自动释放

从同步代码块和同步方法的分析，我们不难看出它们两者是有一个共同点，那就是最终都是会获取到Moniter监视器锁，那么Moniter到底是个啥？对象与Moniter锁的映射关系是怎样的？下面就将详细分析下Moniter

### 对象头

在阐述Moniter，先来了解下对象头，那么为什么要了解对象头？因为synchronized用的锁就是存在Java对象头里的，下面来看下对象头的介绍。

在HotSpot虚拟机中，对象在内存中存储的布局可以分为3块区域：对象头（Header)、实例数据（Instance Data)和对齐填充(Padding)。

HotSpot虚拟机的对象头包括两部分信息： **Mark Word(标记字段) 和 Klass Pointer(类型指针)**。

Mark Word用于存储对象自身的运行时数据，如哈希码(HashCode)、GC分代年龄、锁状态标志、线程持有的锁、偏向线程ID、偏向戳等，如下图所示（在32位HotSpot虚拟机中)：

_\[配图已丢失: ObjectHead-1024x329.png\]_

其中记录的一些信息如下：

*   hash: 对象hashcode
*   age: 对象分代年龄
*   biased\_lock: 是否偏向锁
*   lock: 锁标志
*   JavaThread: 如果是偏向锁，那么记录线程ID

而类型指针，即对象指向它的类元数据的指针，虚拟机通过这个指针来确定这个对象是哪个类的实例。

前面就已经说过，每一个对象都有一个moniter与之关联，在不考虑轻量级与偏向锁的情况下，对象头的MarkWord中的LockWord就会指向monitor的起始地址，接下来轮到Monitor登场了

### Moniter

#### 操作系统中的管程

Monitor，又被称为管程，谈及管程，学过操作系统的小伙伴应该都知道，**管程是用于实现进程间同步的一种机制，它是一种高级同步原语，一个管程是一个由过程、变量及关于共享资源的数据结构等组成的一个集合，它们组成一个特殊的模块或软件包**。

管程作为一种同步机制，管程主要解决两个问题：

*   **互斥**
    *   对于互斥而言，管程是互斥进入的，任意时候，只能有一个进程在管程中执行，调用管程的任何其他进程都被阻塞，以等待管程可用，目的是为了保证管程中数据结构的数据完整性，管程的互斥性是由编译器负责保证的。
*   **同步**
    *   对于同步而言，管程中共设置条件变量及等待/唤醒操作以解决同步问题。这些条件变量包含在管程中，并且只有在管程中才能被访问。

管程的结构大致如下图所示(摘自《操作系统精髓与设计原理》)：

_\[配图已丢失: 管程的结构.png\]_

可以从图中看出，管程提供了一个入口，保证一次只有一个进程可以进入，其他试图进入管程的进程被阻塞并加入等待管程可用的进程队列中，当一个进程在管程中时，它可能会通过发送cwait(x)把自己暂时阻塞在条件x上，随后它被放入等待条件改变以重新进入管程的进程队列中，在cwait(x)调用的下一条指令开始恢复执行。

若在管程中执行的一个进程发现条件变量x发生了变化，则它发送csignal(x)，通知相应的条件队列条件已改变。

假设现在有两个进程，进程1先进入管程，调用cwait(x)把自己阻塞在条件x上，等待条件x满足，此时进来一个进程2，进程2的操作使进程1等待的条件满足，那么此时进程1和进程2究竟谁可以执行呢？毕竟管程要求同一时刻只允许一个线程执行。

实际上在操作系统中存在三种不同的管程模型，分别是：Hasen模型、Hoare模型和MESA模型。它们三者对上述问题的做法不一样：

*   **Hasen模型**里，要求csignal放在代码的最后，这样进程2通知完进程1后，进程2就结束了，然后进程1再执行，这样就能保证同一时刻只有一个进程执行
*   **Hoare模型**里，进程2通知完进程1后，进程2阻塞，进程1马上执行；等进程1执行完，再唤醒进程2，也能保证同一时刻只有一个线程执行，但是相比Hasen模型，进程2多了一次阻塞唤醒操作
*   **MESA模型**里，进程2通知完进程1后，进程2还是会接着执行，进程1并不立即执行，仅仅是从条件变量的等待队列进到入口等待队列里面，这样做的好处是cnotify (在MESA中，csignal原语被cnotify取代) 不用放到代码的最后，进程2也没有多余的阻塞唤醒操作，但是有个副作用，就是当进程1再次执行的时候，可能曾经满足的条件，现在已经不满足了，所以需要以循环方式检验条件变量。

现在应用的最多的就是MESA模型，Java管程的实现也是参考的MESA模型。对于操作系统的管程讲了这么多，再回到Java的Monitor

#### Java的管程Monitor

Java的管程（synchronized) 参考了MESA模型，在MESA模型中，条件变量可以有多个，而在Java语言内置的管程里只有一个条件变量。如下图（摘自极客时间Java并发编程实战专栏):

_\[配图已丢失: Java\_Monitor.png\]_

> 下面参考文章 ：[https://www.hollischuang.com/archives/2030](https://www.hollischuang.com/archives/2030)

具体说，在Java虚拟机(HotSpot)中，Monitor是基于C++实现的，由[ObjectMonitor](https://github.com/openjdk-mirror/jdk7u-hotspot/blob/50bdefc3afe944ca74c3093e7448d6b889cd20d1/src/share/vm/runtime/objectMonitor.hpp#L193)实现的，其主要数据结构如下：  

```c++
ObjectMonitor() {
  _header       = NULL;
  _count        = 0;
  _waiters      = 0,
  _recursions   = 0;
  _object       = NULL;
  _owner        = NULL;
  _WaitSet      = NULL;
  _WaitSetLock  = 0 ;
  _Responsible  = NULL ;
  _succ         = NULL ;
  _cxq          = NULL ;
  FreeNext      = NULL ;
  _EntryList    = NULL ;
  _SpinFreq     = 0 ;
  _SpinClock    = 0 ;
  OwnerIsThread = 0 ;
}
```

ObjectMonitor中有几个关键属性：

*   \_owner: 指向持有ObjectMonitor对象的线程
*   \_WaitSet: 存放处于wait状态的线程队列
*   \_EntryList: 存放处于等待锁block状态的线程队列
*   \_recursions: 锁的重入次数
*   \_count: 用来记录该线程获取锁的次数

当多个线程同时访问一段同步代码时，首先会进入\_EntryList队列中，当某个线程获取到对象的monitor后进入\_Ower区域并把monitor中的\_owner变量设置为当前线程，同时monitor中的计时器\_count加1，即获得对象锁。

> 下面的情况针对调用wait()的时候，如果没有调用wait()，只是synchronized作用的情况，则是利用的Monitor里面的互斥锁

若持有monitor的线程调用wait()方法时，将释放当前持有的monitor，\_owner变量恢复为null，\_count自减1，同时该线程进入\_WaitSet集合中等待被唤醒，若当前线程执行完毕后也将释放monitor锁并复位变量的值，以便其他线程进入获取monitor锁，如下图所示：

_\[配图已丢失: monitor.png\]_

## synchronized的锁升级

synchronized的锁升级，说白了，就是当JVM检测到不同的竞争状况时，会自动切换到适合的锁实现，这种切换就是锁的升级。

在《Java并发编程艺术》一书中谈到：

锁主要存在4种状态：

*   无锁状态
*   偏向锁状态
*   轻量级锁状态
*   重量级锁状态

这几个状态会随着竞争情况逐渐升级，这样的目的就是为了提高获取锁和释放锁的效率

### 偏向锁

当没有多线程竞争，只有一个线程去获取锁，此时进入偏向锁状态。当一个线程访问同步代码并获取锁时会在对象头和栈帧中的锁记录里存储锁偏向的线程ID,以后该线程在进入和退出同步块时不需要CAS操作来加锁和解锁。

**获取偏向锁**

获取偏向锁的详细过程如下：

*   1.判断对象是否为偏向状态，即MarkWord中，偏向标志（biased\_lock)为1，锁标志(lock)为01
*   2.判断是否有线程持有该对象，MarkWord中JavaThread是否有值，如果为空，则进入下一步，如果指向当前线程，则执行同步代码块，如果指向其他线程则进入步骤4
*   3.MarkWord中JavaThread为空则通过cas设置为当前线程的ID，如果成功则获得偏向锁并执行代码块，如果失败则进入步骤4
*   4.CAS失败或者JavaThread中指向了其他线程，则表示有其他线程在竞争，当达到全局安全点时，获得偏向锁的进程被挂起，撤销偏向锁，升级轻量级锁，继续之前的线程

**释放偏向锁**

线程不会主动去释放偏向锁，需要等待其他线程来竞争，此时才会释放偏向锁，偏向锁的撤销需要等待全局安全点（这个时间点上没有正在执行的代码）,步骤如下：

*   1.暂停拥有偏向锁的线程，判断锁对象是否还处于被锁定状态
*   2.撤销偏向苏，恢复到无锁状态（01）或者轻量级锁的状态；

### 轻量级锁

引入轻量级锁的主要目的是在多没有多线程竞争的前提下，减少传统的重量级锁使用操作系统互斥量产生的性能消耗。当关闭偏向锁功能或者多个线程竞争偏向锁导致偏向锁升级为轻量级锁，则会尝试获取轻量级锁，适用于2个线程相互竞争锁的情况。

**获取锁**

*   1.判断当前对象是否处于无锁状态，若是，则JVM首先将在当前线程的栈帧中建立一个名为锁记录(Lock Record)的空间，用于存储锁对象目前的Mark Word的拷贝（官方叫做Displaced Mark Word)，否认执行步骤3
*   2.JVM利用CAS操作尝试将对象的Mark Word更新为指向 Lock Record的指针，如果成功表示竞争到锁，则将锁标志位变成00(表示此对象处于轻量级锁状态),执行同步操作，如果失败则执行步骤3
*   3.判断当前对象的MarkWord是否指向当前线程的栈帧，如果是则表示当前线程已经持有当前对象的锁，则直接执行同步代码块；否则只能说明该锁对象已经被其他线程抢占了，这时轻量级锁需要膨胀为重量级锁，锁标志位变成10，后面等待的线程将会进入阻塞状态

**释放锁**

*   1.取出保存在Displaced Mark Word中的数据
*   2.用CAS操作将取出的数据替换当前对象的Mark Word中，如果成功，则说明释放锁成功，否则执行3
*   3.如果CAS操作替换失败，说明有其他线程尝试获取该锁，则需要在释放锁的同时需要唤起被挂起的线程

### 重量级锁

《Java并发编程艺术》一书是这样描述重量级锁的

> 重量级锁通过对象内部的监视器（monitor）实现，其中monitor的本质是依赖于底层操作系统的Mutex Lock实现，操作系统实现线程之间的切换需要从用户态到内核态的切换，切换成本非常高。

前面我们已经讨论过Monitor了，轻量级锁膨胀成重量级锁，Mark Word的锁标记更新为10，Mark Word指向Monitor（即管程），也就是利用管程中的互斥锁。

当锁处于这个状态下，其他线程试图获取锁都会被阻塞住，当持有锁的线程释放锁之后会唤醒这些线程。

## 小结

关于synchronized原理方面的知识，网上的博客大多都是参考《深入理解Java虚拟机》以及《Java并发编程艺术》这两本书上的内容，本文也不例外。至于为啥还要写？重在总结过程中对知识的思考与考究。

## 参考资料 & 鸣谢

*   《深入理解Java虚拟机》
*   《Java并发编程艺术》
*   《操作系统精髓与设计原理》
*   [https://time.geekbang.org/column/article/86089](https://time.geekbang.org/column/article/86089)
*   [https://www.hollischuang.com/archives/2030](https://www.hollischuang.com/archives/2030)
*   [http://cmsblogs.com/?p=2071](http://cmsblogs.com/?p=2071)
*   [http://www.woowen.com/java/2017/01/01/JAVA%20Synchronized/](http://www.woowen.com/java/2017/01/01/JAVA%20Synchronized/)
*   [https://wiki.openjdk.java.net/display/HotSpot/Synchronization](https://wiki.openjdk.java.net/display/HotSpot/Synchronization)
