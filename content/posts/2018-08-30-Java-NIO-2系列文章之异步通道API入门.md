---
title: "Java NIO.2系列文章之异步通道API入门"
date: 2018-08-30
slug: "Java-NIO-2系列文章之异步通道API入门"
tags: ["Java", "NIO.2"]
---
**Catalogue**

1.  [1. NIO.2概览](#NIO-2概览)
2.  [2. 异步通道API](#异步通道API)
    1.  [2.1. Future](#Future)
    2.  [2.2. CompletionHandler](#CompletionHandler)
3.  [3. 异步通道API实例](#异步通道API实例)
    1.  [3.1. 服务端 (with Future)](#服务端-with-Future)
    2.  [3.2. 服务端(With CompletionHandler)](#服务端-With-CompletionHandler)
        1.  [3.2.1. AsynchronousChannelGroup类](#AsynchronousChannelGroup类)
    3.  [3.3. 客户端](#客户端)
    4.  [3.4. 测试结果](#测试结果)
4.  [4. Java NIO 2异步IO的体现](#Java-NIO-2异步IO的体现)
5.  [5. 小结](#小结)
6.  [6. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## NIO.2概览

NIO.2也就是人们常说的 AIO，在Java 7中引入了NIO的改进版NIO 2，它是异步非阻塞的IO方式。

AIO的核心概念就是发起非阻塞方式的I/O操作，立即响应，却不立即返回结果，当I/O操作完成时通知。

这篇文章主要介绍NIO 2的异步通道API的一些内容，后续文章再分析NIO.2的其他特性

## 异步通道API

从Java 7开始，java.nio.channel包中新增加4个异步通道：

*   AsynchronousSocketChannel
*   AsynchronousServerSocketChannel
*   AsynchronousFileChannel
*   AsynchronousDatagramChannel

这些类在风格上与NIO 通道API相似，他们共享相同的方法与参数结构体，并且大多数对于NIO通道类可用的参数，对于新的异步版本仍然可用。

异步通道API提供了两种对已启动异步操作的监测与控制机制:

*   第一种通过返回一个 **java.util.concurrent.Future对象**来表示异步操作的结果
*   第二种是通过传递给操作一个新类的对象**java.nio.channels.CompletionHandler**来完成，它会定义在操作完毕后所执行的处理程序方法。

### Future

**从Java 1.5开始，引入了Future接口，使用该接口可以在任务执行完毕之后得到任务执行结果**。在NIO 2中，Future对象表示异步操作的结果，假设我们要创建一个服务器来监听客户端连接，打开AsynchronousServerSocketChannel 并将其绑定到类似于 ServerSocketChannel的地址:  

```java
AsynchronousServerSocketChannel server 
  = AsynchronousServerSocketChannel.open().bind(null);
```

方法bind() 将一个套接字地址作为其参数，这里传递了一个Null地址，它会自动将套接字绑定到本地主机地址，并使用空闲的临时端口，就像传统的 ServerSocket设置 0端口一样，也是使用操作系统随机分配的临时端口。  
然后调用服务器的accept()方法:  

```
Future<AsynchronousSocketChannel> future = server.accept();
```

当我们在NIO中调用 ServerSocketChannel的accept()方法时，它会阻塞，直到从客户端收到传入连接。但是AsynchronousServerSocketChannel 的accept() 方法会立即返回 Future 对象。

Future对象的泛型类型是操作的返回类型，在上面的例子，它是 AsynchronousSocketChannel ，但它也可以是Integer或String ,具体取决于操作的最终返回类型。

我们可以使用Future对象来查询操作的状态  

```
future.isDone();
```

如果基础操作已经完成，则此API返回 true,请注意，在这种情况下，完成可能意味着正常终止，异常，或者取消。

我们还可以明确检查操作是否被取消,如果操作在正常完成之前被取消，则它返回true。如下:  

```
future.isCancelled();
```

实际的取消操作，如下:  

```
future.cancel(true)
```

cancel()方法可利用一个布尔标志来指出执行接受的线程是否可被中断。

要检索操作结果，我们使用get()方法，该方法将阻塞等待结果的返回:  

```java
AsynchronousSocketChannel client= future.get();
```

另外，我们也可以设置阻塞时间,下例设置为10s:  

```
AsynchronousSocketChannel worker = future.get(10, TimeUnit.SECONDS);
```

### CompletionHandler

使用 Future 来处理操作的替代方法是使用 CompletionHandler 类的回调机制。异步通道允许指定完成处理程序以使用操作的结果:  

```java
AsynchronousServerSocketChannel listener
  = AsynchronousServerSocketChannel.open().bind(null);
 
listener.accept(
  attachment, new CompletionHandler<AsynchronousSocketChannel, Object>() {
    public void completed(
      AsynchronousSocketChannel client, Object attachment) {
          // do whatever with client
      }
    public void failed(Throwable exc, Object attachment) {
          // handle failure
      }
  });
```

I/O操作成功完成时，将调用已完成的回调 API。如果操作失败，则调用失败的API.

## 异步通道API实例

### 服务端 (with Future)

下面是使用 Future的方式构建服务端。  

```java
public class AsyncEchoServer {
    private AsynchronousServerSocketChannel server;
    private Future<AsynchronousSocketChannel> future;
    private AsynchronousSocketChannel worker;

    public AsyncEchoServer() throws IOException, ExecutionException, InterruptedException {
        System.out.println("Open Server Channel");
        server = AsynchronousServerSocketChannel.open().bind(new InetSocketAddress("127.0.0.1", 9090));
        future = server.accept();
    }

    public void runServer() throws ExecutionException, InterruptedException, IOException, TimeoutException {
        //获取操作结果
        worker = future.get();
        if (worker != null && worker.isOpen()) {
            ByteBuffer buffer = ByteBuffer.allocate(100);
            //将通道中的数据写入缓冲区
            worker.read(buffer).get(10,TimeUnit.SECONDS);
            System.out.println("received from client: " + new String(buffer.array()));
        }
        server.close();
    }

    public static void main(String[] args) throws InterruptedException, ExecutionException, IOException, TimeoutException {
        AsyncEchoServer server = new AsyncEchoServer();
        server.runServer();
    }
}
```

### 服务端(With CompletionHandler)

下面我们将了解如何使用 CompletionHandler 方法而不是 Future 方法实现相同的服务端代码。  

```java
public class AsyncEchoServerWithCallBack {
    private AsynchronousServerSocketChannel server;
    private AsynchronousSocketChannel worker;
    private AsynchronousChannelGroup group;
    public AsyncEchoServerWithCallBack() throws IOException, ExecutionException, InterruptedException {
        System.out.println("Open Server Channel");
        group = AsynchronousChannelGroup.withFixedThreadPool(10, Executors.defaultThreadFactory());
        server = AsynchronousServerSocketChannel.open(group).bind(new InetSocketAddress("127.0.0.1", 9090));
        //当有新连接建立时会调用 CompletionHandler接口实现对象中的 completed()方法
        server.accept(null, new CompletionHandler<AsynchronousSocketChannel, Object>() {
            @Override
            public void completed(AsynchronousSocketChannel result, Object attachment) {
                if (server.isOpen()) {
                    server.accept(null, this);
                }
                worker = result;
                if ((worker != null) && (worker.isOpen())) {
                    ByteBuffer byteBuffer = ByteBuffer.allocate(100);
                    worker.read(byteBuffer);
                    System.out.println("received the client: "+new String(byteBuffer.array()));
                }
            }

            @Override
            public void failed(Throwable exc, Object attachment) {
                //TODO
            }
        });
    }
    public static void main(String[] args) throws InterruptedException, ExecutionException, IOException, TimeoutException {
        AsyncEchoServerWithCallBack server = new AsyncEchoServerWithCallBack();
    }
}
```

当有新连接建立时会调用 CompletionHandler接口实现对象中的 completed()方法，当出现错误时，会调用 failed方法。

accept方法的第一个参数可以是一个任意类型的对象，称为调用时的” 附加对象”。附件对象在 accept()方法调用时传入，可以在 CompletionHandler 接口的实现对象中从 completed 和 failed 方法的参数(attachment)中获取，这样就可以进行数据的传递。使用 CompletionHandler接口的方法都支持使用附件对象来传递数据。

#### AsynchronousChannelGroup类

**异步通道在处理 I/O请求时，需要使用一个AsynchronousChannelGroup类，该类的对象表示的是一个异步通道的分组，每一个分组都有一个线程池与之对应**，需要使用AsynchronousChannelGroup类的静态工厂方法 withFixedThreadPool,withCachedThreadPool或者 withThreaPool设置线程池。这个线程池中的线程用来处理 I/O 事件。多个异步通道可以共用一个分组的线程池资源。

调用AsynchronousSocketChannel 和 AsynchronousServerSocketChannel 类的 open 方法 打开异步套接字通道时，可以传入一个AsynchronousChannelGroup类的对象。如果调用的 open 方法没有传入 AsynchronousChannelGroup 类的对象，默认使用系统提供的分组，系统分组对应的线程池中的线程是**守护线程**，如果使用默认分组，程序启动之后很快就退出了，**因为系统分组使用的守护线程不会阻止虚拟机的退出。**

### 客户端

```java
public class AsyncEchoClient {
    private AsynchronousSocketChannel client;
    private Future<Void> future;

    public AsyncEchoClient() throws IOException {
        //打开一个异步channel
        System.out.println("Open client channel");
        client = AsynchronousSocketChannel.open();
        //连接本地端口和地址,在连接成功后不返回任何内容，但是，我们仍然可以使用Future对象来监视异步操作的状态
        System.out.println("Connect to server");
        future = client.connect(new InetSocketAddress("127.0.0.1", 9090));
    }

    /**
     * 向服务端发送消息
     *
     * @param message
     * @return
     */
    public void sendMessage(String message) throws ExecutionException, InterruptedException {
        if (!future.isDone()) {
            future.cancel(true);
            return;
        }
        //将一个字节数组封装到ByteBuffer中
        ByteBuffer byteBuffer = ByteBuffer.wrap(message.getBytes());
        System.out.println("Sending message to the server");
        //将数据写入通道
        int numberBytes = client.write(byteBuffer).get();
        byteBuffer.clear();
    }

    public static void main(String[] args) throws IOException, ExecutionException, InterruptedException {
        AsyncEchoClient client = new AsyncEchoClient();
        client.sendMessage("hello world");
    }
}
```

### 测试结果

客户端:  

```java
Open client channel
Connect to server
```

服务端:  

```java
Open Server Channel
received the client: hello world
```

## Java NIO 2异步IO的体现

我们都知道由 JDK 1.7提供的NIO 2.0 新增了异步的套接字通道，它是真正的异步 IO，在异步IO操作的时候可以传递变量，当操作完成之后会回调相关的方法。那么NIO 2的异步非阻塞特性是如何体现的呢？从之前的描述就可以窥见很多细节:

**异步的体现**

以 `AsynchronousServerSocketChannel`为例，当调用该类的对象的 accept()方法时，其返回了一个 `Future<AsynchronousSocketChannel>`对象，调用accept()方法就像调用传统I/O中的`ServerSocket的accept()`一样，本质上都是接收客户端连接请求，只不过`AsynchronousServerSocketChannel`对象没有一直阻塞等待，而是立马返回一个`Future`对象，利用`Future`的`get`方法去获取连接结果，`Future`对象就是异步操作的结果，我们还可以利用Future的`isDone`方法查询操作完成的状态，这就是异步的体现。

当然在使用 CompletionHandler 方法中一样的道理，有新连接建立时会回调 CompletionHandler接口实现对象中的 completed()方法，当出现错误时，会调用 failed方法。

**非阻塞的体现**

当调用`AsynchronousServerSocketChannel`对象的 accept()方法后，返回Future对象，此时线程可以接着干其他事情，这是非阻塞的，要想获得操作结果，就调用 Future的 `isDone`方法查询操作是否完毕，使用 `get()`去获取结果，典型的非阻塞操作。而在传统 I/O模型中，套接字类对象的 `accept`方法会一直阻塞等待，直到有新连接接入进来才停止阻塞。

## 小结

NIO.2,也叫AIO,了解其异步通道API,也能更好地帮助我们去理解异步IO操作。当我们学习NIO2的API时，也可以对照NIO中的通道API进行学习，它们还是有很多相似的地方。

## 参考资料 & 鸣谢

*   [NIO.2 入门，第 1 部分 异步通道 API](https://www.ibm.com/developerworks/cn/java/j-nio2-1/index.html)
*   [A Guide to NIO2 Asynchronous Socket Channel](https://www.baeldung.com/java-nio2-async-socket-channel)
*   [《深入理解Java 7:核心技术与最佳实践》](https://book.douban.com/subject/10734875/)
