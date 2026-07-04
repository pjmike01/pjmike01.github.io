---
title: "Netty系列文章之Netty线程模型"
date: 2019-10-20
slug: "Netty系列文章之Netty线程模型"
tags: ["Netty"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Reactor_1.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Reactor_2.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Reactor_NIO_Pool.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Reactor_3.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Reactor_Mutiple.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Netty_reactor_1.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Netty_reactor_2.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/%E5%88%86%E5%B8%83%E5%BC%8F/Netty/Netty_reactor_3.png"
---
## 前言

我们在使用Netty进行服务端开发的时候，一般来说会定义两个NioEventLoopGroup线程池，一个”bossGroup”线程池去负责处理客户端连接，一个”workGroup”线程池去负责处理读写操作。那么，我们为什么要这么做呢？这样做的好处是什么呢？能不能只使用一个NioEventLoopGroup呢？这就是我们今天要讨论的主题——Netty的线程模型

## Reactor线程模型

实际上Netty线程模型就是Reactor模式的一个实现，而Reactor模式又是什么呢？

Reactor模式是基于事件驱动开发的，核心组成部分包括Reactor和线程池，其中Reactor负责监听和分配事件，线程池负责处理事件，而根据Reactor的数量和线程池的数量，又将Reactor分为三种模型:

*   单线程模型 (单Reactor单线程)
*   多线程模型 (单Reactor多线程)
*   主从多线程模型 (多Reactor多线程)

### 单线程模型

_\[配图已丢失: Reactor\_1.png\]_

> 图片摘自：[http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

*   Reactor内部通过**selector** 监控连接事件，收到事件后通过**dispatch**进行分发，如果是连接建立的事件，则由Acceptor处理，**Acceptor**通过accept接受连接，并创建一个Handler来处理连接后续的各种事件,如果是读写事件，直接调用连接对应的**Handler**来处理
*   **Handler完成read->(decode->compute->encode)->send的业务流程**
*   这种模型好处是简单，坏处却很明显，当某个Handler阻塞时，会导致其他客户端的handler和accpetor都得不到执行，无法做到高性能，只适用于业务处理非常快速的场景

### 多线程模型

_\[配图已丢失: Reactor\_2.png\]_

> 图片摘自：[http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

*   主线程中，Reactor对象通过selector监控连接事件,收到事件后通过dispatch进行分发，如果是连接建立事件，则由Acceptor处理，Acceptor通过accept接收连接，并创建一个Handler来处理后续事件，而Handler只负责响应事件，不进行业务操作，也就是只进行read读取数据和write写出数据，业务处理交给一个线程池进行处理
*   线程池分配一个线程完成真正的业务处理，然后将响应结果交给主进程的Handler处理，Handler将结果send给client (下面是核心代码)

_\[配图已丢失: Reactor\_NIO\_Pool.png\]_

单Reactor承当所有事件的监听和响应,而当我们的服务端遇到大量的客户端同时进行连接，或者在请求连接时执行一些耗时操作，比如身份认证，权限检查等，这种瞬时的高并发就容易成为性能瓶颈

### 主从多线程模型 （最流行）

_\[配图已丢失: Reactor\_3.png\]_

> 图片摘自：[http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

*   存在多个Reactor，**每个Reactor都有自己的selector选择器**，线程和dispatch
*   主线程中的mainReactor通过自己的selector监控连接建立事件，收到事件后通过Accpetor接收，将新的连接分配给某个子线程
*   子线程中的subReactor将mainReactor分配的连接加入连接队列中通过自己的selector进行监听，并创建一个Handler用于处理后续事件
*   Handler完成read->业务处理->send的完整业务流程

_\[配图已丢失: Reactor\_Mutiple.png\]_

## Netty中的线程模型与Reactor的联系

Netty主要靠NioEventLoopGroup线程池来实现具体的线程模型的

### 单线程模型

单线程模型就是只指定一个线程执行客户端连接和读写操作，也就是在一个Reactor中完成，对应在Netty中的实现就是将NioEventLoopGroup线程数设置为1，核心代码是：  

```java
NioEventLoopGroup group = new NioEventLoopGroup(1);
       ServerBootstrap bootstrap = new ServerBootstrap();
       bootstrap.group(group)
               .channel(NioServerSocketChannel.class)
               .channel(NioServerSocketChannel.class)
               .option(ChannelOption.TCP_NODELAY, true)
               .option(ChannelOption.SO_BACKLOG, 1024)
               .childHandler(new ServerHandlerInitializer());
```

它的工作流程大致如下：

_\[配图已丢失: Netty\_reactor\_1.png\]_

上述单线程模型就对应了Reactor的单线程模型

### 多线程模型

多线程模型就是在一个单Reactor中进行客户端连接处理，然后业务处理交给线程池，核心代码如下：  

```java
NioEventLoopGroup eventGroup = new NioEventLoopGroup();
ServerBootstrap bootstrap = new ServerBootstrap();
bootstrap.group(eventGroup)
        .channel(NioServerSocketChannel.class)
        .option(ChannelOption.TCP_NODELAY, true)
        .option(ChannelOption.SO_BACKLOG, 1024)
        .childHandler(new ServerHandlerInitializer());
```

走进group方法可以发现我们平时设置的bossGroup和workerGroup就是使用了同一个group  

```java
@Override
public ServerBootstrap group(EventLoopGroup group) {
    return group(group, group);
}
```

工作流程如下：

_\[配图已丢失: Netty\_reactor\_2.png\]_

### 主从多线程模型 (最常使用)

主从多线程模型是有多个Reactor，也就是存在多个selector，所以我们定义一个bossGroup和一个workGroup，核心代码如下：  

```java
NioEventLoopGroup bossGroup = new NioEventLoopGroup();
NioEventLoopGroup workerGroup = new NioEventLoopGroup();
ServerBootstrap bootstrap = new ServerBootstrap();
bootstrap.group(bossGroup,workerGroup)
        .channel(NioServerSocketChannel.class)
        .option(ChannelOption.TCP_NODELAY, true)
        .option(ChannelOption.SO_BACKLOG, 1024)
        .childHandler(new ServerHandlerInitializer());
```

工作流程如下：

_\[配图已丢失: Netty\_reactor\_3.png\]_

**注意：其实在Netty中，bossGroup线程池最终还是只会随机选择一个线程用于处理客户端连接，与此同时，NioServerSocetChannel绑定到bossGroup的线程中，NioSocketChannel绑定到workGroup的线程中**

## 小结

以上总结了Reactor的三种模型以及Netty中的对应实现，在Netty中，我们使用的最多的还是主从多线程模型。关于Reactor的学习，最权威的资料应该是Doug Lea大神的[Scalable IO in Java](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)，有兴趣的同学可以看看

## 参考资料

*   [http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)
*   [https://time.geekbang.org/column/article/8805](https://time.geekbang.org/column/article/8805)
*   [https://segmentfault.com/a/1190000007403873](https://segmentfault.com/a/1190000007403873)
*   [https://www.infoq.cn/article/netty-threading-model](https://www.infoq.cn/article/netty-threading-model)
