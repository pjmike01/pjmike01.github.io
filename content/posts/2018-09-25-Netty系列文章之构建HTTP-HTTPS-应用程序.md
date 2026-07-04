---
title: "Netty系列文章之构建HTTP(HTTPS)应用程序"
date: 2018-09-25
slug: "Netty系列文章之构建HTTP-HTTPS-应用程序"
tags: ["Netty"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/tcp-ip_model_ssl-tls_protocol.png"
  - "http://osvtz719h.bkt.clouddn.com/sslhandler.jpg"
  - "http://osvtz719h.bkt.clouddn.com/httprequset.jpg"
  - "http://osvtz719h.bkt.clouddn.com/httpreponse.JPG"
  - "http://osvtz719h.bkt.clouddn.com/httpservercodec.png"
  - "http://osvtz719h.bkt.clouddn.com/curlHttp.png"
  - "http://osvtz719h.bkt.clouddn.com/server_log.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. SSL/TLS协议简介](#SSL-TLS协议简介)
    1.  [2.1. JDK的javax.net.ssl包 VS Netty的OpenSSL/SSLEngine](#JDK的javax-net-ssl包-VS-Netty的OpenSSL-SSLEngine)
3.  [3. HTTP请求和响应组成部分](#HTTP请求和响应组成部分)
4.  [4. HTTP解码器、编码器和编解码器](#HTTP解码器、编码器和编解码器)
5.  [5. 应用程序代码](#应用程序代码)
    1.  [5.1. 代码解读](#代码解读)
        1.  [5.1.1. HttpHelloWorldServerHandler](#HttpHelloWorldServerHandler)
        2.  [5.1.2. AsciiString](#AsciiString)
    2.  [5.2. 测试](#测试)
6.  [6. 小结](#小结)
7.  [7. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

这篇文章主要介绍如何用Netty构建一个HTTP/HTTPS应用程序，用一个HelloWorld级Demo进行阐述

## SSL/TLS协议简介

因为要同时构建HTTPS应用程序，所以我们需要通过使用 SSL/TLS保护Netty应用程序，这里先简单介绍下 SSL/TLS协议。

SSL和TLS都是运输层的安全协议， 它们发展历史如下：

*   1995： SSL 2.0 ,由Netscape提出，这个版本由于设计缺陷，并不安全，很快被发现有严重漏洞，已经废弃
*   1996：SSL 3.0写成RFC,开始流行，目前(从2015年)已经不安全，必须禁用
*   1999：TLS1.0互联网标准化组织ISOC接替NetScape公司，发布了**SSL 的升级版TLS1.0版**
*   2006: TLS 1.1. 作为 RFC 4346 发布。主要fix了CBC模式相关的如BEAST攻击等漏洞
*   2008: TLS 1.2. 作为RFC 5246 发布 。增进安全性。目前(2015年)应该主要部署的版本，请确保你使用的是这个版本
*   2015之后: TLS 1.3，还在制订中，支持0-rtt，大幅增进安全性，砍掉了aead之外的加密方式

由于SSL的2个版本都已经退出历史舞台，**现在一般所说的SSL就是TLS**

SSL/TLS安全协议示意图如下：

_\[配图已丢失: tcp-ip\_model\_ssl-tls\_protocol.png\]_

SSL/TLS协议是一个位于HTTP层与TCP层之间的可选层，其提供的服务主要有：

*   认证用户和服务器，确保数据发送到正确的客户机和服务器
*   加密数据以防止数据中途被窃取
*   维护数据的完整性，确保数据在传输过程中不被改变

关于SSL/TLS协议更加详细的介绍可以查找相关资料，这里就不细说了。

### JDK的javax.net.ssl包 VS Netty的OpenSSL/SSLEngine

为了支持 SSL/TLS，Java提供了 javax.net.ssl 包，它的 SSLContext 和 SSLEngine 类使得解密和加密相当简单和高效。SSLContext是SSL链接的上下文，SSLEngine主要用于出站和入站字节流的操作。

Netty还提供了使用 OpenSSL工具包的SSLEngine实现，该SSLEngine比JDK提供的SSLEngine实现有更好的性能

Netty通过一个名为`SslHandler`的`ChannelHandler`实现加密和解密的功能，其中`SslHandler`在内部使用SSLEngine来完成实际的工作，SSLEngine的实现可以是JDK的`SSLEngine`,也可以是 Netty 的`OpenSslEngine`，当然推荐使用Netty的OpenSslEngine，因为它性能更好，通过SslHandler进行解密和加密的过程如下图所示（摘自《Netty In Action》）：

_\[配图已丢失: sslhandler.jpg\]_

大多数情况下，SslHandler 将是 ChannelPipeline 中的第一个 ChannelHandler。这确保了只有在所有其他的 ChannelHandler 将它们的逻辑应用到数据之后，才会进行加密。

## HTTP请求和响应组成部分

HTTP是基于请求/响应模型的的: 客户端向服务端发送一个HTTP请求，然后服务端将会返回一个HTTP响应，Netty提供了多种编码器和解码器以简化对这个协议的使用。

HTTP请求的组成部分如下图：

_\[配图已丢失: httprequset.jpg\]_

HTTP响应的组成部分如下图:

_\[配图已丢失: httpreponse.JPG\]_

如上面两图所示，一个HTTP请求/响应可能由多个数据部分组成，并且它总是以一个 LastHttpContent 部分作为结束。 `FullHttpRequest`和`FullHttpResponse`消息是特殊的子类型，分别代表了完整的请求和响应。

所有类型的HTTP消息都实现了 `HttpObject` 接口

## HTTP解码器、编码器和编解码器

Netty为HTTP消息提供了编码器和解码器：

*   `HttpRequestEncoder`: 编码器，用于客户端，向服务器发送请求
*   `HttpResponseEecoder`: 编码器，用于服务端，向服务端发送响应
*   `HttpRequestDecoder`:解码器，用于服务端，接收来自客户端的请求
*   `HttpResponseDecoder`: 解码器，用于客户端，接收来自服务端的请求

**编解码器**：

*   `HttpClientCodec`: 用于客户端的编解码器，等效于 `HttpRequestEncoder`和`HttpResponseDecoder`的组合
*   `HttpServerCodec`:用于服务端的编解码器，等效于 `HttpRequsetDecoder`和 `HttpResponseEncoder`的组合

以`HttpServerCodec`为例，它的类继承结构图如下：

_\[配图已丢失: httpservercodec.png\]_

HttpServerCodec 同时实现了 `ChannelInboundHandler`和 `ChannelOutboundHandler`接口，以达到同时具有编码和解码的能力。

**聚合器**：

*   `HttpObjectAggregator`: 聚合器，可以将多个消息部分合并为 `FullHttpRequest`或者 `FullHttpResponse`消息。使用该聚合器的原因是HTTP解码器会在每个HTTP消息中生成多个消息对象，如`HttpRequest/HttpResponse,HttpContent,LastHttpContent`,使用聚合器将它们聚合成一个完整的消息内容，这样就不用关心消息碎片了。

## 应用程序代码

构建基于Netty的HTTP/HTTPS 应用程序的源代码出自于Netty官方提供的demo,我略微做了一些改动，原地址是：[https://github.com/netty/netty/tree/4.1/example/src/main/java/io/netty/example/http/helloworld](https://github.com/netty/netty/tree/4.1/example/src/main/java/io/netty/example/http/helloworld)

源代码：  

```java
public class HttpHelloWorldServer {


    static final boolean SSL = System.getProperty("ssl") != null;
    static final int PORT = Integer.parseInt(System.getProperty("port", SSL ? "8443" : "8080"));

    public static void main(String[] args) throws Exception {
        final SslContext sslContext;
        //判断SSL是否为true,为true表示使用HTTPS连接，反之，使用HTTP
        if (SSL) {
            //使用Netty自带的证书工具生成一个数字证书
            SelfSignedCertificate certificate = new SelfSignedCertificate();
            sslContext = SslContextBuilder.forServer(certificate.certificate(), certificate.privateKey()).build();
        } else {
            sslContext = null;
        }
        EventLoopGroup boss = new NioEventLoopGroup(1);
        EventLoopGroup worker = new NioEventLoopGroup();
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(boss, worker)
                    .channel(NioServerSocketChannel.class)
                    .handler(new LoggingHandler(LogLevel.INFO))
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            if (sslContext != null) {
                                pipeline.addLast(sslContext.newHandler(ch.alloc()));
                            }
                            //添加一个HTTP的编解码器
                            pipeline.addLast(new HttpServerCodec());
                            //添加HTTP消息聚合器
                            pipeline.addLast(new HttpObjectAggregator(64 * 1024));
                            //添加一个自定义服务端Handler
                            pipeline.addLast(new HttpHelloWorldServerHandler());
                        }
                    });
            ChannelFuture future = bootstrap.bind(PORT).sync();
            System.err.println("Open your web browser and navigate to " +
                    (SSL? "https" : "http") + "://127.0.0.1:" + PORT + '/');

            future.channel().closeFuture().sync();
        } finally {
            boss.shutdownGracefully().sync();
            worker.shutdownGracefully().sync();
        }

    }

}
```

### 代码解读

首先判断系统属性ssl是否存在，如果存在，则表明使用安全连接，反之，则使用一般的HTTP连接。

```java
final SslContext sslContext;
      if (SSL) {
          SelfSignedCertificate certificate = new SelfSignedCertificate();
          sslContext = SslContextBuilder.forServer(certificate.certificate(), certificate.privateKey()).build();
      } else {
          sslContext = null;
      }
```

上面代码所示，当SSL为true时，使用Netty自带的签名证书工具自定义服务端发送给客户端的数字证书。

接下来和一般的Netty服务端程序步骤一样，先创建 `ServerBootstrap`启动类，设置和绑定 `NioEventLoopGroup`线程池，创建服务端 Channel，添加ChannelHandler。值得注意的是，添加的ChannelHandler都是与HTTP相关的Handler。

#### HttpHelloWorldServerHandler

自定义的Handler代码如下：  

```java
public class HttpHelloWorldServerHandler extends SimpleChannelInboundHandler<HttpObject> {
    private static final AsciiString CONTENT_TYPE = AsciiString.cached("Content-Type");
    private static final AsciiString CONTENT_LENGTH = AsciiString.cached("Content-Length");
    private static final AsciiString CONNECTION = AsciiString.cached("Connection");
    private static final AsciiString KEEP_ALIVE = AsciiString.cached("keep-alive");
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, HttpObject msg) throws Exception {
        if (msg instanceof HttpRequest) {
            HttpRequest req = (HttpRequest) msg;
            System.out.println("浏览器请求方式："+req.method().name());
            String content = "";
            if ("/hello".equals(req.uri())) {
                content = "hello world";
                response2Client(ctx,req,content);
            } else {
                content = "Connect the Server";
                response2Client(ctx,req,content);
            }
        }
    }

    private void response2Client(ChannelHandlerContext ctx, HttpRequest req, String content) {
        boolean keepAlive = HttpUtil.isKeepAlive(req);
        FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.OK, Unpooled.wrappedBuffer(content.getBytes()));
        response.headers().set(CONTENT_TYPE, "text/plain");
        response.headers().setInt(CONTENT_LENGTH, response.content().readableBytes());
        if (!keepAlive) {
            ctx.write(response).addListener(ChannelFutureListener.CLOSE);
        } else {
            response.headers().set(CONNECTION, KEEP_ALIVE);
            ctx.write(response);
        }
    }

    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        ctx.flush();
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();
        ctx.close();
    }
}
```

在此Handler中处理入站数据流，但该代码只是处理`GET`请求，没有对`POST`请求做出处理，所以当浏览器发送一个 `GET`请求时，此Handler定义一个HTTP响应体 `FullHttpResponse`，设置一些响应头，如·`Content-type`、`Connection`、`Content-Length`等，设置响应内容，然后通过`ctx.write`方法写入HTTP消息

#### AsciiString

在设置响应头时我们用到了 **AsciiString**，从Netty 4.1开始，提供了实现了 `CharSequence` 接口的 `AsciiString`,至于 `CharSequence`就是 `String`的父类。`AsciiString` 包含的字符只占1个字节，当你处理 US-ASCII 或者 ISO-8859-1 字符串时可以节省空间。例如，HTTP编解码器使用 `AsciiString`处理 header name ,因为将`AsciiString`编码到 `ByteBuf`中不会有类型转换的代价，其内部实现就是用的 `byte`，而对于`String`来说，内部是存 `char[]`,使用 String就需要将 char转换成 byte，所以`AsciiString` 比String类型有更好的性能。

### 测试

客户端测试：

_\[配图已丢失: curlHttp.png\]_

服务端日志：

_\[配图已丢失: server\_log.png\]_

## 小结

以上总结了如何使用Netty构建一个简单的HTTP/HTTPS应用程序。当然上面的程序参考的是Netty官方提供的Demo，Netty官方还提供了很多其他方面的例子，对于入门学习来说还不错，详细地址是： [https://github.com/netty/netty/tree/4.1/example/src/main/java/io/netty/example](https://github.com/netty/netty/tree/4.1/example/src/main/java/io/netty/example)

## 参考资料 & 鸣谢

*   [SSL/TLS协议运行机制的概述](http://www.ruanyifeng.com/blog/2014/02/ssl_tls.html)
*   [TLS协议分析 与 现代加密通信协议设计](https://blog.helong.info/blog/2015/09/07/tls-protocol-analysis-and-crypto-protocol-design/)
*   [Netty In Action](https://book.douban.com/subject/27038538/)
