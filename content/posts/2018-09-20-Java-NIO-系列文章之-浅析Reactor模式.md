---
title: "Java NIO 系列文章之 浅析Reactor模式"
date: 2018-09-20
slug: "Java-NIO-系列文章之-浅析Reactor模式"
tags: ["NIO", "Reactor"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/Reactor_Simple.png"
  - "http://osvtz719h.bkt.clouddn.com/reactor1.png"
  - "http://osvtz719h.bkt.clouddn.com/reacor1_nio.jpg"
  - "http://osvtz719h.bkt.clouddn.com/reactor2.png"
  - "http://osvtz719h.bkt.clouddn.com/reactor2_nio.png"
  - "http://osvtz719h.bkt.clouddn.com/Reactor3_nio.png"
  - "http://osvtz719h.bkt.clouddn.com/reactor3_nio.jpg"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. Reactor的介绍](#Reactor的介绍)
    1.  [2.1. 模式比较](#模式比较)
3.  [3. Reactor模式的三种实现](#Reactor模式的三种实现)
    1.  [3.1. 单Reactor单线程](#单Reactor单线程)
        1.  [3.1.1. 单Reactor单线程在NIO中的实现](#单Reactor单线程在NIO中的实现)
    2.  [3.2. 单Reactor多线程](#单Reactor多线程)
        1.  [3.2.1. 单Reactor多线程在 Java NIO中的实现](#单Reactor多线程在-Java-NIO中的实现)
    3.  [3.3. 多Reactor多进程/线程](#多Reactor多进程-线程)
        1.  [3.3.1. 多Reactor多线程在 Java NIO中的体现](#多Reactor多线程在-Java-NIO中的体现)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

最近研究 Java NIO 的时候，常常看到一种 设计模式——Reactor模式，以前没接触过这个模式在Netty中也有应用，那么Reactor模式是什么？为什么要使用Reactor模式？在NIO中如何实现Reactor模式？下面将揭开 Reactor的神秘面纱

> 下面的介绍参考了网上很多相关资料，所以可能会与网上某些资料有重复的情况

## Reactor的介绍

Reactor 是一种和 IO 相关的设计模式，Java中的NIO中天生就对 Reactor模式提供了很好的支持，比较著名的就是 [Doung Lea](https://baike.baidu.com/item/Doug%20Lea/6319404) 大神在 [《Scalable IO in Java》](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)演示如何使用 NIO 实现Reactor模式

在维基百科上对 Reactor模式定义如下:

> The reactor design pattern is an **event handling pattern** for handling service requests **delivered concurrently to a service handler** by one or more inputs. The service handler then **demultiplexes** the incoming requests and dispatches them synchronously to the associated request handlers

从上面的描述我们可以得到几个关键点：

*   一种事件驱动模型
*   处理多个输入
*   采用多路复用将事件分发给相应的Handler处理

_\[配图已丢失: Reactor\_Simple.png\]_

在[netty学习系列二：NIO Reactor模型 & Netty线程模型](https://www.jianshu.com/p/38b56531565d)这篇文章谈到，Reactor实际上采用了**分而治之**和**事件驱动**的思想：

> **分而治之**： 一个连接里完整的网络处理过程一般分为 accept，read，decode，process，encode，send这几步。而Reactor模式将每个步骤映射为 一个Task，服务端线程执行的最小逻辑单元不再是一个完整的网络请求，而是 Task，且采用非阻塞方式执行。

> **事件驱动**： 每个Task 对应特定的网络事件，当Task 准备就绪时，Reactor 收到对应的网络事件通知，并将Task 分发给绑定了对应网络事件的 Handler 执行。

总结以上几个特点，再次说明下 **Reactor模式就是 指一个或多个事件输入同时传递给服务处理器(Reactor)，服务处理器负责监听各事件的状态，当任意一个事件准备就绪时，服务处理器收到该事件通知，并将事件发送给绑定了该对应网络事件的事件处理器(Handler)执行**

**Reactor模式也叫做Dispatcher模式**，即 I/O多路复用统一监听事件，收到事件后再分发(Dispatch)给相应的处理线程。

### 模式比较

谈到 Reactor模式就会让我想起观察者模式，它俩看起来非常相似的，但是观察者模式主要用于**一对多**的情况，它定义了一个一对多的依赖关系，让多个观察者对象监听一个主题对象，当被观察者状态改变时，需要通知相应的观察者，使这些观察者能够自动更新。所以**实际上它们还是有不同的，观察者模式与单个事件源关联，而Reactor模式与多个事件源关联**。

## Reactor模式的三种实现

> 以下的说明参考了Alibaba资深技术专家李运华的极客时间专栏[从0开始学架构](https://time.geekbang.org/column/intro/81?code=OK4eM0TBPTKGPRCzcZdzIeXjPACLfY3KCzATXOSWzXE%3D)中对于Reactor的介绍

Reactor模式有三种典型的实现方案：

*   单Reactor单线程
*   单Reactor多线程
*   主从Reactor多线程

在介绍三个方案之前，先来了解下Reactor模式中的几个角色：

*   **Reactor**: 负责响应事件，将事件分发绑定了该事件的Handler处理
*   **Handler**: 事件处理器，绑定了某类事件，负责执行对应事件的任务对事件进行处理
*   **Acceptor**：Handler的一种，绑定了 connect 事件，当客户端发起connect请求时，Reactor会将accept事件分发给Acceptor处理
    
    ### 单Reactor单线程
    

_\[配图已丢失: reactor1.png\]_

PS: 以上的select，accept,read,send是标准I/O复用模型的网络编程API,dispatch和”业务处理”是需要完成的操作。

方案的具体步骤如下:

*   Reactor对象通过select监控连接事件，收到事件后通过dispatch进行分发
*   如果是连接建立的事件，则交由 Acceptor 通过accept 处理连接请求，然后创建一个 Handler 对象处理连接完成后的后续业务处理
*   如果不是建立连接事件，则 Reactor 会分发调用连接对应的 Handler来响应
*   Handler 会完成 read -> 业务处理 -> send 的完整业务流程

**单Reactor单线程的优点**：

*   模型简单，没有多线程，进程通信，竞争的问题，全部都在一个线程中完成

**缺点**：

*   只有一个进程，无法发挥多核 CPU的性能，只能采取部署多个系统来利用多核CPU,但这样会带来运维复杂度
*   Handler 在处理某个连接上的业务时，整个进程无法处理其他连接的事件，很容易导致性能瓶颈

#### 单Reactor单线程在NIO中的实现

下图是单Reactor单线程在 Java NIO中流程图：

_\[配图已丢失: reacor1\_nio.jpg\]_

至于单Reactor单线程在 NIO 中的代码，详情参阅 [Doung Lea](https://baike.baidu.com/item/Doug%20Lea/6319404) 大神的 [《Scalable IO in Java》](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

### 单Reactor多线程

_\[配图已丢失: reactor2.png\]_

方案步骤:

*   主线程中，Reactor对象通过select 监听连接事件，收到事件后通过 dispatch进行分发
*   如果是连接建立的事件，则由Acceptor处理，Acceptor通过 accept接受连接，并创建一个 Handler 来处理连接后续的各种事件。
*   如果不是连接建立事件，则Reactor会调用连接对应的Handler来进行相应
*   Handler 只负责响应事件，不进行业务处理，Handler 通过 read 读取到数据后，会发给 processor 进行业务处理
*   Processor 会在独立的子线程中完成真正的 业务处理，然后将响应结果发给主进程的 Handler处理，Handler 收到响应后通过 send 将响应结果返回给 client

**优点**:

*   能够充分利用多核多 CPU的处理能力

**缺点**：

*   多线程数据共享和访问比较复杂
*   Reactor 承担所有事件的监听和响应，只在主线程中运行，瞬间高并发时会成为性能瓶颈

#### 单Reactor多线程在 Java NIO中的实现

下图是单Reactor多线程在 Java NIO实现的流程图  

_\[配图已丢失: reactor2\_nio.png\]_

说明:

*   有专门一个Reactor线程用于监听服务器 ServerSocketChannel，接收客户端的TCP连接请求
*   网络IO的读/写操作等由一个 worker reactor线程池负责，由线程池中的NIO线程负责监听 SocketChannel事件，进行消息的读取，解码，编码和发送
*   一个 NIO 线程可以同时处理 N条链路，但是一个链路只注册在一个NIO 线程上处理，防止发生并发操作问题。

至于单Reactor多线程在 NIO 中的代码，详情参阅 [Doung Lea](https://baike.baidu.com/item/Doug%20Lea/6319404) 大神的 [《Scalable IO in Java》](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

### 多Reactor多进程/线程

下图以多Reactor多进程为例  

_\[配图已丢失: Reactor3\_nio.png\]_

方案说明:

*   主进程中mainReactor对象通过 select监控连接建立事件，收到事件后通过 Acceptor接收，将新的连接分配给某个子进程。
*   子进程中的 subReactor 将 mainReactor 分配的连接加入连接队列进行监听，并创建一个 Handler 用于处理连接的各种事件
*   当有新的事件发生时，subReactor 会调用里连接对应的 Handler 来响应
*   Handler完成 read -> 业务处理 -> send 的完整业务流程

**特点**:

*   主进程和子进程的职责非常明确，主进程只负责接收新连接，子进程负责完成后续的业务处理
*   主进程和子进程的交互很简单，主进程只需要把新的连接传递给子进程，子进程无需返回数据
*   子进程之间是相互独立的，无需同步共享之类的处理（这里仅限于网络模型相关的 select,read,send等无须同步共享，”业务处理”还是有可能需要同步共享的）

#### 多Reactor多线程在 Java NIO中的体现

_\[配图已丢失: reactor3\_nio.jpg\]_

## 小结

上面的总结参考了很多大神的分析，算是对 **Reactor模式** 有个初步的认识。

## 参考资料 & 鸣谢

*   [《Scalable IO in Java》](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)
*   [netty学习系列二：NIO Reactor模型 & Netty线程模型](https://www.jianshu.com/p/38b56531565d)
*   [极客时间专栏-从0开始学架构](https://time.geekbang.org/column/intro/81?code=OK4eM0TBPTKGPRCzcZdzIeXjPACLfY3KCzATXOSWzXE%3D)
