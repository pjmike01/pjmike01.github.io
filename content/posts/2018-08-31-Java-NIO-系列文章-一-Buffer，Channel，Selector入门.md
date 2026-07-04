---
title: "Java NIO 系列文章 (一) Buffer，Channel，Selector入门"
date: 2018-08-31
slug: "Java-NIO-系列文章-一-Buffer，Channel，Selector入门"
tags: ["Java", "NIO"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/channel.jpg"
  - "http://osvtz719h.bkt.clouddn.com/channe.png"
  - "http://osvtz719h.bkt.clouddn.com/buffer.png"
  - "http://osvtz719h.bkt.clouddn.com/buffers-modes.png"
  - "http://osvtz719h.bkt.clouddn.com/selector.png"
  - "http://osvtz719h.bkt.clouddn.com/slee.JPG"
  - "http://osvtz719h.bkt.clouddn.com/selector3.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. NIO类库简介](#NIO类库简介)
3.  [3. 通道 Channel](#通道-Channel)
    1.  [3.1. Channel的实现](#Channel的实现)
    2.  [3.2. Channel的例子](#Channel的例子)
4.  [4. 缓冲区 Buffer](#缓冲区-Buffer)
    1.  [4.1. Buffer的类型](#Buffer的类型)
    2.  [4.2. Buffer的内部属性](#Buffer的内部属性)
    3.  [4.3. Buffer的基本用法](#Buffer的基本用法)
5.  [5. 多路复用器 Selector](#多路复用器-Selector)
    1.  [5.1. 为什么使用 Selector？](#为什么使用-Selector？)
    2.  [5.2. Selector 的创建](#Selector-的创建)
    3.  [5.3. 向 Selector 注册通道](#向-Selector-注册通道)
        1.  [5.3.1. 选择键SelectionKey](#选择键SelectionKey)
        2.  [5.3.2. 可选择通道SelectableChannel](#可选择通道SelectableChannel)
    4.  [5.4. 通过 Selector 选择通道](#通过-Selector-选择通道)
        1.  [5.4.1. select()方法](#select-方法)
        2.  [5.4.2. selectedKeys()](#selectedKeys)
    5.  [5.5. wakeUp()](#wakeUp)
    6.  [5.6. close()](#close)
    7.  [5.7. Selector图示](#Selector图示)
6.  [6. 示例代码](#示例代码)
    1.  [6.1. 服务端](#服务端)
    2.  [6.2. 客户端](#客户端)
    3.  [6.3. 测试结果](#测试结果)
    4.  [6.4. socketChannel的read()方法](#socketChannel的read-方法)
7.  [7. 小结](#小结)
8.  [8. 参考文章](#参考文章)

## 前言

> 下面部分内容参考 [Java NIO 系列教程-并发编程网](http://ifeve.com/java-nio-all/)

## NIO类库简介

NIO 库是在JDK 1.4中引入的，NIO 弥补了原来同步阻塞 I/O 的不足，它在标准Java代码中提供了高速的，面向块的I/O。NIO的核心部分主要有:

*   **通道 Channel**
*   **缓冲区 Buffer**
*   **多路复用器 Selector**

下面一一介绍着三大核心部分。

## 通道 Channel

Channel 是一个通道，它就像自来水管一样，网络数据通过 Channel 读取和写入。

通道与流的不同之处在于:

*   通道是双向的，既可以从通道中读取数据,也可以写数据到通道，而流的读写通常是单向的，它只是在一个方向上移动
*   通道可以异步地读写
*   通道中的数据总是要先读到一个缓冲区Buffer，或者总是要从一个 Buffer 中写入

_\[配图已丢失: channel.jpg\]_

### Channel的实现

Channel本质是一个接口，它在有很多重要的实现  

_\[配图已丢失: channe.png\]_

*   **FileChannel**
    
    > FileChannel从文件中读取数据，也可以将数据写到文件中,FileChannel无法设置非阻塞模式，它总是运行在阻塞模式下。
    
*   **DatagramChannel**
    
    > DatagramChannel通过UDP读写网络中的数据
    
*   **SocketChannel**
    
    > SocketChannel通过TCP读写网络中的数据
    
*   **ServerSocketChannel**
    
    > 可以监听新进来的TCP连接，像 Web 服务器那样，对每一个新进来的连接都会创建一个SocketChannel。
    

**SocketChannel**和**ServerSocketChannel** 就对应 传统网络编程中的 **Socket类**和**ServerSocket类**

### Channel的例子

下面以 **FileChannel**为例来写一个关于通道与缓冲区的例子，代码如下:  

```java
public class ChannelTest {
    public static void main(String[] args) throws IOException {
        RandomAccessFile accessFile = new RandomAccessFile("C:\\Users\\Administrator\\Desktop\\nio-data.txt", "rw");
        //打开FileChannel
        FileChannel fileChannel = accessFile.getChannel();
        ByteBuffer byteBuffer = ByteBuffer.allocate(48);
        //从通道里读取数据到缓冲区
        int bytesRead = fileChannel.read(byteBuffer);
        while (bytesRead != -1) {
            System.out.println("Read: "+bytesRead);
            //反转
            byteBuffer.flip();
            //从缓冲区中读取数据
            while (byteBuffer.hasRemaining()) {
                System.out.print((char)byteBuffer.get());
            }
            byteBuffer.clear();
            bytesRead = fileChannel.read(byteBuffer);
        }
        accessFile.close();
    }
}
```

*   在使用 FileChannel 之前，必须先打开它，我们无法直接打开它，需要通过一个InputStream，OutputStream或者RandomAccessFile 来打开它
*   从 FileChannel 中读取数据，先分配一个Buffer（关于Buffer的介绍参见下文），调用 FileChannel 的read()方法，该方法返回的 int 值表示了有多少字节被读到了 Buffer 中

## 缓冲区 Buffer

在NIO库中，数据是从通道读入到缓冲区，从缓冲区写入到通道中的。

缓冲区本质上是一块可以写入的数据，然后可以从读取数据的内存。这块内存被封装成了 NIO Buffer 对象，并提供了一组方法，用来方便的访问该块内存。

### Buffer的类型

Java NIO有以下几种Buffer 类型  

_\[配图已丢失: buffer.png\]_

*   ByteBuffer: 字节缓冲区
*   MappedByteBuffer: 用于实现内存映射文件
*   CharBuffer: 字符缓冲区
*   ShortBuffer: 短整型缓冲区
*   IntBuffer: 整型缓冲区
*   LongBuffer: 长整形缓冲区
*   FloatBuffer: 浮点型缓冲区
*   DoubleBuffer: 双精度浮点型缓冲区

### Buffer的内部属性

缓冲区Buffer 内部就是用数组实现的。Buffer 包含了下面4个属性:

*   **Capacity (容量)**
    
    > 缓冲区能够容纳的数据元素的最大数量。这个容量在缓冲区创建时被设定，并且永远不会被改变。你只能往里写 capacity 个 byte，long，char等类型。一旦 Buffer 满了，需要将其清空 (通过读数据或者清除数据) 才能往里写数据
    

*   **Limit (上界)**
    
    > 缓冲区的第一个不能被读或写的元素，或者说缓冲区现存元素的上界。在写模式下，Buffer的limit 表示最多能往 Buffer 里写多少数据。写模式下，limit 等于 Buffer 的capacity。当切换Buffer到读模式，limit表示你最多能读到多少数据。此时limit会被设置成写模式下的position值。
    

*   **Position (位置)**
    
    > 缓冲区内下一个将要被读或写的元素位置，在进行读写缓冲区时，位置为自动更新。当你写数据到Buffer中时，position表示当前的位置。初始值为0，当数据写到Buffer后，position会向前移动到下一个可插入的Buffer单元，最大值为capacity-1。
    

*   **Mark (标记)**
    
    > 一个备忘位置，初始时为”未定义”，调用mark()来设定 mark = position。调用reset()设定 position = mark
    

4个属性之间的关系:

> Invariants: mark <= position <= limit <= capacity

下面这张图表示了Buffer中的属性:  

_\[配图已丢失: buffers-modes.png\]_

### Buffer的基本用法

以上面 Channel 的例子为样，使用 Buffer 一般遵循以下几个步骤:

*   调用 allocate() 方法分配 Buffer
*   写入数据到 Buffer
*   调用 flip() 方法
*   从 Buffer中读取数据
*   调用 clear() 方法或者compact()方法

**Buffer的分配**

要想获得一个 Buffer 对象首先要进行分配，每一个Buffer类都有一个 allocate 方法，下面是一个分配 48 字节 capacity 的 ByteBuffer 的例子  

```java
ByteBuffer buf = ByteBuffer.allocate(48)
```

**向 Buffer 中写数据**

写数据到Buffer 有两种方式:

*   从 Channel 写到 Buffer中

```
int bytesRead = fileChannel.read(buf);
```

*   通过 Buffer 的 put()方法写到 Buffer里
    
    ```
    buf.put("hello world".getBytes());
    ```
    

**flip()方法**

flip方法将 Buffer 从写模式切换到读模式。调用flip()方法会将 position 设回0，并将limit 设置为之前的 position的值。

换句话说，position 现在用于标记读的位置 ，limit 表示现在能够读取多少个 byte,char等

**从Buffer中读取数据**

从Buffer中读取数据有两种方法:

*   从 Buffer 读取数据到 Channel
    
    ```
    int byteWritten = fileChannel.write(buf);
    ```
    
*   使用get() 方法从Buffer中读取数据
    
    ```
    byte aByte = buf.get();
    ```
    

**rewind()方法**

> Buffer.rewind()方法将position 设回 0 ，所以你可以重读 Buffer中的所有数据。limit保持不变，仍然表示能从 Buffer中读取多少个元素

**clear()方法**

> 一旦读完Buffer中的数据，需要让Buffer准备好再次被写入。可以通过clear()。调用的是clear()方法，position将被设回0，limit被设置成 capacity的值。换句话说，Buffer 被清空了。Buffer中的数据并未清除，只是这些标记告诉我们可以从哪里开始往Buffer里写数据。

## 多路复用器 Selector

Selector 是Java NIO实现多路复用的基础，简单的讲，Selector 会不断地轮询注册在其上的 Channel，如果某个Channel 上面发生读或者写事件，这个Channel 就处于就绪状态，会被Selector轮询出来，然后通过 SelectionKey 可以获取就绪 Channel 的集合，进行后续的 I/O 操作。  
**这样，一个单独的线程可以管理多个 Channel ，从而管理多个网络连接，跟 I/O多路复用模型思想一样。**

### 为什么使用 Selector？

> 如果不使用Selector要监听多个Channel上的操作，需要多线程操作，一个线程监听一个通道上的事件，多线程之间的切换对操作系统有一定的开销，而且编程也复杂，还占用资源（内存）。

> 但是，需要记住，现代的操作系统和CPU在多任务方面表现的越来越好，所以多线程的开销随着时间的推移，变得越来越小。实际上，如果一个CPU有多个内核，不使用多任务可能是在浪费CPU能力。只不过这里我们只需要知道Selector 能够处理多个通道就足够了。

下面单线程使用一个 Selector 处理 3 个 channel 的示例图:

_\[配图已丢失: selector.png\]_

### Selector 的创建

通过调用 Selector.open ()方法创建一个Selector，如下:  

```
Selector selector = Selector.open()
```

### 向 Selector 注册通道

为了将 Channel 和 Selector 配合使用，必须将 Channel 注册到 selector 上，通过 `SelectableChannel.register()` 来实现。如下：  

```java
serverSocketChannel = ServerSocketChannel.open();
//设置为非阻塞模式
serverSocketChannel.configureBlocking(false);
//绑定端口
serverSocketChannel.bind(new InetSocketAddress(port));
System.out.println("listener on port: " + port);
//选择器的创建
selector = Selector.open();
//向选择器注册通道
serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);
```

ServerSocketChannel 继承了 SelectableChannel。  

_\[配图已丢失: slee.JPG\]_

  
注意 `register()` 方法的第二个参数，这是一个 “interest集合”，意思是在通过 Selector 监听 Channel 时对什么事件感兴趣，可以监听4种不同类型的事件:

*   Connnet
*   Accept
*   Read
*   Write

通道触发了一个事件意思是该事件已经就绪，所以，某个 ServerSocketChannel 准备好接收新接入的连接称为 “接收就绪”。这4种事件用 SelectionKey的4个常量来表示:

*   SelectionKey.OP\_CONNECT
*   SelectionKey.OP\_ACCEPT
*   SelectionKey.OP\_READ
*   SelectionKey.OP\_WRITE

#### 选择键SelectionKey

> 选择键封装了特定的通道与特定的选择器的注册关系，选择键对象被 `SelectableChannel.register()` 返回并提供一个表示这种注册关系的标记，选择键包含了两个比特集 (以整数的形式进行编码)，指示了该注册关系所关心的通道操作，以及通道已经准备好的操作。

#### 可选择通道SelectableChannel

> 这个抽象类提供了实现通道的可选择性所需要的公共方法。它是所有支持就绪检查的通道类的父类。 **FileChannel 对象不是可选择的，因为他们没有继承 SelectableChannel** 。所有 socket 通道都是可选择的，包括从管道 (Pipe) 对象中获得的通道。**SelectableChannel 可以被注册到 Selector 对象上，同时可以指定对那个选择器而言，哪种操作是感兴趣的，一个通道可以被注册到多个选择器上，但对每个选择器而言只能被注册一次**。

### 通过 Selector 选择通道

#### select()方法

一旦向 Selector 注册了一或多个通道，就可以调用几个重载的 select()方法，这些方法返回你所感兴趣的事件 (如 连接，接受，读或写)已经准备就绪的那些通道。

下面是 select() 方法:

*   int select() 阻塞到至少有一个通道在你注册的事件上就绪了。
*   int select(long timeout) 和select()一样，除了最长会阻塞 timeout 毫秒
*   int selectNow():不会阻塞，不管什么通道就绪都立刻返回

select()方法返回的 int 值表示有多少通道已经就绪。也就是，自上次调用 select() 方法后有多少通道变成就绪状态，如果调用 select() 方法，因为有一个通道变成就绪状态，返回了1，若再次调用 select() 方法，如果另一个通道就绪了，它会再次返回1.

#### selectedKeys()

一旦调用了 select() 方法，并且返回值表明有一个或更多个通道就绪了，然后可以通过调用 selector 的 selectedKeys() 方法，访问 “已选择键集”中的就绪通道。  

```java
Set selectedKeys = selector.selectedKeys();
```

当向 Selectorv 注册 Channel 时，Channel.register() 方法会返回这个对象代表了注册到该 Selector 的通道，可以通过 SelectionKey 的selectedKeySet()方法访问这些对象。如下:  

```java
Set selectedKeys = selector.selectedKeys();
Iterator keyIterator = selectedKeys.iterator();
while(keyIterator.hasNext()) {
    SelectionKey key = keyIterator.next();
    if(key.isAcceptable()) {
        // a connection was accepted by a ServerSocketChannel.
    } else if (key.isConnectable()) {
        // a connection was established with a remote server.
    } else if (key.isReadable()) {
        // a channel is ready for reading
    } else if (key.isWritable()) {
        // a channel is ready for writing
    }
    keyIterator.remove();
}
```

这个循环遍历已选择键集中的每个键，并检测各个键所对应的通道的就绪事件

**注意每次迭代末尾的 keyIterator.remove()调用**，Selector 不会自己从已选择键中 移除 SelectionKey实例，必须在处理完通道时自己移除，下次该通道变成就绪时，Selector会再次将其放入已选择键中。

### wakeUp()

某个线程调用 select() 方法后阻塞了，即使没有通道已经就绪，也有办法让其从 select()方法返回。只要让其他线程在第一个线程调用 select () 方法的那个对象上调用 Selector.wakeup()方法即可，阻塞在 select()方法上的线程会立马返回。如果有其他线程调用了wakeup()方法，但当前没有线程阻塞在 select() 方法上，下个调用 select() 方法的线程会立即 “醒来(wake up)”。

### close()

用完Selector后调用其close()方法会关闭该Selector，且使注册到该Selector上的所有SelectionKey实例无效。通道本身并不会关闭。

### Selector图示

_\[配图已丢失: selector3.png\]_

## 示例代码

### 服务端

```java
public class ServerSocketChannelTest {
    private int size = 1024;
    private ServerSocketChannel serverSocketChannel;
    private ByteBuffer byteBuffer;
    private Selector selector;
    private final int port = 9999;
    private int remoteClientNum = 0;

    public ServerSocketChannelTest() {
        try {
            initChannel();
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(-1);
        }
    }

    public void initChannel() throws IOException {
        serverSocketChannel = ServerSocketChannel.open();
        //设置为非阻塞模式
        serverSocketChannel.configureBlocking(false);
        //绑定端口
        serverSocketChannel.bind(new InetSocketAddress(port));
        System.out.println("listener on port: " + port);
        //选择器的创建
        selector = Selector.open();
        //向选择器注册通道
        serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);
        //分配缓冲区大小
        byteBuffer = ByteBuffer.allocate(size);
    }
    private void listener() throws Exception {
        while (true) {
            //返回的int值表示有多少通道就绪
            int n = selector.select();
            if (n == 0) {
                continue;
            }
            Iterator<SelectionKey> iterator = selector.selectedKeys().iterator();
            while (iterator.hasNext()) {
                SelectionKey key = iterator.next();
                //ServerSocketChannel 处于接收就绪状态
                if (key.isAcceptable()) {
                    ServerSocketChannel server = (ServerSocketChannel) key.channel();
                    SocketChannel channel = server.accept();
                    registerChannel(selector, channel, SelectionKey.OP_READ);
                    //远程客户端连接数
                    remoteClientNum++;
                    System.out.println("online client num="+remoteClientNum);
                    replyClient(channel);
                }
                //如果通道已经处于读就绪状态
                if (key.isReadable()) {
                    readDataFromSocket(key);
                }
                iterator.remove();
            }
        }
    }

    private void readDataFromSocket(SelectionKey key) throws IOException {
        SocketChannel socketChannel = (SocketChannel) key.channel();
        int count;
        byteBuffer.clear();
        //从通道中读数据到缓冲区
        while ((count = socketChannel.read(byteBuffer)) > 0) {
            //byteBuffer从上面的写模式变为读模式
            byteBuffer.flip();
            while (byteBuffer.hasRemaining()) {
                System.out.print((char)byteBuffer.get());
            }
            byteBuffer.clear();

        }
        if (count < 0) {
            socketChannel.close();
        }
    }

    private void replyClient(SocketChannel channel) throws IOException {
        byteBuffer.clear();
        byteBuffer.put("hello client!".getBytes());
        //byteBuffer从写模式变成读模式
        byteBuffer.flip();
        //将缓冲区的数据写入通道中
        channel.write(byteBuffer);
    }

    private void registerChannel(Selector selector, SocketChannel channel, int opRead) throws IOException {
        if (channel == null) {
            return;
        }
        channel.configureBlocking(false);
        channel.register(selector, opRead);
    }

    public static void main(String[] args) {
        try {
            new ServerSocketChannelTest().listener();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
```

### 客户端

```java
public class SocketChannelTest {
    private int size = 1024;
    private ByteBuffer byteBuffer;
    private SocketChannel socketChannel;
    public void connectServer() throws IOException {
        socketChannel = SocketChannel.open();
        socketChannel.connect(new InetSocketAddress("127.0.0.1", 9999));
        socketChannel.configureBlocking(false);
        byteBuffer = ByteBuffer.allocate(size);
        receive();
    }

    private void receive() throws IOException {
        while (true) {
            byteBuffer.clear();
            int count;
            //如果没有数据可读了，read()方法会一直阻塞
            while ((count = socketChannel.read(byteBuffer)) > 0) {
                byteBuffer.flip();
                while (byteBuffer.hasRemaining()) {
                    System.out.print((char)byteBuffer.get());
                }
                send2Server("say hi".getBytes());
                byteBuffer.clear();
            }
        }
    }

    private void send2Server(byte[] bytes) throws IOException {
        byteBuffer.clear();
        byteBuffer.put(bytes);
        byteBuffer.flip();
        socketChannel.write(byteBuffer);
    }

    public static void main(String[] args) throws IOException {
        new SocketChannelTest().connectServer();
    }
}
```

### 测试结果

```
# 服务端
listener on port: 9999
online client num=1
say hi
# 客户端
hello client!
```

### socketChannel的read()方法

在调试客户端代码的过程中发现，socketChannel的read()方法默认情况下是阻塞模式，若没有数据可读或者缓冲区满了以后，就会一直阻塞，直到满足读的条件。我们可以根据 read()返回的 int值推断出此时数据发送的情况:

*   **read()返回 -1**: 数据发送完毕，并主动关闭连接，此时返回 -1
*   **read()返回 0**:
    *   socketChannel当前没有数据可读返回 0
    *   ByteBuffer的position 等于 limit,此时返回0

## 小结

这篇文章是对 [Java NIO Tutorial](http://tutorials.jenkov.com/java-nio/index.html)教程的一个学习笔记，大部分内容参考了该教程，这个教程在网上应该算是比较好的NIO 教程，网上很多写 NIO的文章，多多少少都借鉴参考了此教程，该教程在并发编程网上还有对应的中文版翻译——[Java NIO 系列教程](http://ifeve.com/java-nio-all/)，也是相当不错。

## 参考文章

*   [Java NIO Tutorial](http://tutorials.jenkov.com/java-nio/index.html)
*   [Java NIO 系列教程](http://ifeve.com/java-nio-all/)
*   [Java NIO系列教程（六） 多路复用器Selector](https://www.cnblogs.com/duanxz/p/6782783.html)
