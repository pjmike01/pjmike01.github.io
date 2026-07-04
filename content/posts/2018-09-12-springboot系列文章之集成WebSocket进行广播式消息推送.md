---
title: "springboot系列文章之集成WebSocket进行广播式消息推送"
date: 2018-09-12
slug: "springboot系列文章之集成WebSocket进行广播式消息推送"
tags: ["springboot", "websocket"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/websocket.png"
  - "http://osvtz719h.bkt.clouddn.com/message-flow-simple-broker.png"
  - "http://osvtz719h.bkt.clouddn.com/websocker1.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. WebSocket简介](#WebSocket简介)
    1.  [2.1. WebSocket的特点](#WebSocket的特点)
3.  [3. SockJS](#SockJS)
4.  [4. STOMP](#STOMP)
    1.  [4.1. STOMP帧](#STOMP帧)
5.  [5. WebSocket、SockJS、STOMP的关系](#WebSocket、SockJS、STOMP的关系)
6.  [6. SpringBoot整合WebSocket](#SpringBoot整合WebSocket)
    1.  [6.1. 导入依赖](#导入依赖)
    2.  [6.2. WebSocket配置](#WebSocket配置)
7.  [7. 请求消息类](#请求消息类)
8.  [8. 响应消息类](#响应消息类)
9.  [9. 处理来自客户端的STOMP消息](#处理来自客户端的STOMP消息)
    1.  [9.1. 订阅注解 @SubcribeMapping](#订阅注解-SubcribeMapping)
    2.  [9.2. 利用SimpMessagingTemplate](#利用SimpMessagingTemplate)
10.  [10. 客户端](#客户端)
     1.  [10.1. 测试结果](#测试结果)
11.  [11. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

在springboot整合websocket之前，先简单阐述下websocket的基本概念，以及与它相关的sockjs，stomp又是什么。

## WebSocket简介

WebSocket协议是 HTML5新增的一种在单个TCP连接上进行全双工通讯的协议，在 WebSocket API 中，浏览器和服务器只需要做一个握手的动作，然后，浏览器和服务器之间就形成一条快速通道，两者之间就直接可以数据相互传送了。

WebSocket与HTTP的不同之处在于:

> WebSocket是一种全双工通信协议，在建立连接后，WebSocket服务器和浏览器端都能够主动的向对方发送消息，就像Socket一样。而HTTP只能由客户端发起请求，服务器返回查询结果，做不到服务器主动向客户端发送请求，如下图所示

_\[配图已丢失: websocket.png\]_

### WebSocket的特点

这里总结下WebSocket的特点：

*   WebSocket服务器和浏览器都能够主动向对方发送消息
*   建立在 TCP协议之上，服务器的实现比较容易
*   与HTTP 协议有着良好的兼容性，默认端口也是 80和443，并且握手阶段采用HTTP协议，可以通过HTTP代理
*   数据格式比较轻量，性能开销小，通信高效
*   可以发送文本，也可以发送二进制数据
*   没有同源限制，客户端可以与任意服务器通信
*   协议标识符是 `ws`(如果加密，则为`wss`),服务器网址是URL

## SockJS

> SockJS是一个浏览器上运行的JavaScript库，如果浏览器不支持 WebSocket,该库可以模拟对 WebSocket的支持，实现浏览器和Web服务器之间的低延迟，全双工，跨域的通讯通道

## STOMP

> STOMP即 Simple(or Streaming) Text Oriented Messaging Protocol 的简称，简单(流)文本定向消息协议，它提供了一个可户操作的连接格式，允许 STOMP 客户端与任意 STOMP消息代理(Broker)进行交互，STOMP协议由于设计简单，易于开发客户端，因此在多种语言和多种平台上得到广泛应用

之前的介绍谈到 WebSocket是基于 TCP协议的，直接使用WebSocket(或者SockJS)来编程就与直接使用TCP套接字来编程web应用类似，这会非常难受，因为没有高层协议，因此就需要我们定义应用间所发送消息的语义，还需要确保连接两端都能遵循这些语义。

那么现在STOMP就派上用场了，**同HTTP在TCP套接字上添加请求-响应模型层一样，STOMP在 WebSocket之上提供了一个基于帧的线路格式层，用来定义消息语义**。

### STOMP帧

STOMP帧由命令，一个或多个头消息以及负载所组成，如下所示是一个发送数据的STOMP帧：  

```java
   SEND
destination:/app/room-message
content-length:20

{\"message\":\"Hello!\"}
```

对上面分析如下:

*   SEND: STOMP命令，表明会发送一些内容
*   destination: 头消息，用来表示消息发送到哪里
*   content-length: 头信息，用来表示负载内容的大小
*   空行
*   帧内容(负载)内容

## WebSocket、SockJS、STOMP的关系

简单说就是,WebSocket是基于TCP的底层协议，SockJS是WebSocket的备选方案，用于那些不支持WebSocket的浏览器，也是底层协议，而STOMP是 WebSocket的上层协议，是高级协议

## SpringBoot整合WebSocket

前面铺垫了一些基础知识过后，下面进入本篇文章的主题，使用SpringBoot+WebSocket+SockJS+STOMP搭建一个广播式的WebSocket

### 导入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### WebSocket配置

```java
@Configuration
@EnableWebSocketMessageBroker //启用STOMP消息
public class WebSocketStompConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        //注册STOMP端点，即WebSocket客户端需要连接到WebSocket握手端点
        //这是一个端点，客户端在订阅或发布消息到目的地路径前，要连接该端点
        registry.addEndpoint("/point")
                //跨域设置
                .setAllowedOrigins("*")
                //启用SockJS功能
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        //设置消息代理，所有目的地前缀为"/topic","/queue"的消息都会发送到STOMP代理中
        registry.enableSimpleBroker("/topic", "/queue");
        //设置应用程序的目的地前缀为"/app",当有以应用程序为目的地的消息将会直接路由到带有@MessageMapping注解的控制器方法
        registry.setApplicationDestinationPrefixes("/app");
    }
}
```

对上述程序程序进行分析:

*   `@EnableWebSocketMessageBroker`注解不仅配置了WebSocket，还配置了基于代理的STOMP消息
*   重载了`registerStompEndpoints`方法，将”/point”注册为STOMP端点，客户端需要先连接该端点
*   重载`configureMessageBroker`配置消息代理，同时设置应用程序的目的地前缀，当以应用程序为目的地的消息将会直接路由到带`@MessageMapoping`注解的控制器方法

下图来自[spring-websocket官方文档](https://docs.spring.io/spring/docs/5.0.0.M5/spring-framework-reference/html/websocket.html),表示为websocket的通讯模型图  

_\[配图已丢失: message-flow-simple-broker.png\]_

解读一下模型图:

> 对于同一个目标:/a，它的前缀将会决定消息该如何处理，分为两种:`/app/a` 和`/topic/a`，如果是为 `/topic/a`，那么可以直接将消息体发送到 简单代理消息处理器上，而如果是 `/app/a`，那么它会先将消息路由到应用程序内部带有 `@MessageMapping`注解的控制器方法中，在控制器方法中进行处理，然后将处理结果发送到 `brokeChannel`,最后再将消息发送到简单代理消息处理器上，两种情况最后都是经由代理再发送到客户端的目的地的。

## 请求消息类

```java
public class RequestMessage {
    private String name;

    public String getName() {
        return name;
    }
}
```

## 响应消息类

```java
public class ResponseMessage {
    private String responseMessage;

    public ResponseMessage(String responseMessage) {
        this.responseMessage = responseMessage;
    }

    public ResponseMessage() {
    }

    public String getResponseMessage() {
        return responseMessage;
    }

    public void setResponseMessage(String responseMessage) {
        this.responseMessage = responseMessage;
    }
}
```

## 处理来自客户端的STOMP消息

借助 **@MessageMapping** 注解在控制器中处理 STOMP消息,代码如下：  

```java
@Controller
public class GreetingController {
    /**
     * 处理发往 /app/greeting目的地的消息
     *
     * @param greeting
     * @return
     */
    @MessageMapping("/greeting")
//    @SendTo("/topic/say")
    public ResponseMessage handle(RequestMessage greeting) {
        //Spring的某一个消息转换器会将STOMP消息的负载转换为 RequestMessage对象
        System.out.println(greeting.getName());
        return new ResponseMessage("welcome，" + greeting.getName());
    }
}
```

代码分析：

*   handle方法处理客户端发往目的地为 `/app/greeting`的消息，`/app`为隐含的，因为在配置类中我们将其设置为应用的目的地前缀
*   该方法有一个`RequestMessage`参数，实际上是Spring利用消息转换器将消息负载转换成了 RequestMessage对象
*   该方法返回一个 `ResponseMessage`实体，Spring使用消息转换器将这个返回的ResponseMessage对象转换为消息负载
*   默认情况下，返回消息的目的地与客户端发送消息的目的地想用，只不过会添加 `/topic`，当然我们也可以使用 **@SendTo**注解重载返回消息的目的地。

### 订阅注解 @SubcribeMapping

当客户端订阅一个地址的时候，我们也可以使用`@SubcribeMapping`注解发送一条消息，作为订阅的回应:  

```java
@SubscribeMapping("/subscribe")
 public ResponseMessage subscribe() {
     ResponseMessage responseMessage = new ResponseMessage();
     responseMessage.setResponseMessage("欢迎订阅");
     return responseMessage;
 }
```

这里的注解 @SubcribeMapping 注解表明当客户端订阅 `/app/subscribe`（/app是应用目的地的前缀）目的地的时候，将会调用 subscribe()方法，并返回一个ResponseMessage对象

### 利用SimpMessagingTemplate

我们也可以使用SimpMessagingTemplate，Spring的SimpMessagingTemplate 能够在应用的任何地方发送消息，甚至不需要首先接收一条消息作为前提。

## 客户端

客户端编写需要添加stomp.js和sock.js，下面是具体客户端代码:  

```html
<html>
<head>
    <meta charset="UTF-8"/>
    <title>广播式WebSocket</title>
    <script src="js/sockjs.min.js"></script>
    <script src="js/stomp.js"></script>
    <script src="js/jquery-3.1.1.js"></script>
</head>
<body onload="disconnect()">
<noscript><h2 style="color: #e80b0a;">Sorry，浏览器不支持WebSocket</h2></noscript>
<div>
    <div>

        <button id="connect" onclick="connect();">连接</button>
        <button id="disconnect" disabled="disabled" onclick="disconnect();">断开连接</button>
    </div>

    <div id="conversationDiv">
        <label>输入你的名字</label><input type="text" id="name"/>
        <button id="sendName" onclick="sendName();">发送</button>
        <p id="response"></p>
        <p id="callback"></p>
    </div>
</div>
<script type="text/javascript">
    var stompClient = null;

    function setConnected(connected) {
        document.getElementById("connect").disabled = connected;
        document.getElementById("disconnect").disabled = !connected;
        document.getElementById("conversationDiv").style.visibility = connected ? 'visible' : 'hidden';
        $("#response").html();
        $("#callback").html();
    }

    function connect() {
        <!--连接stomp端点-->
        var socket = new SockJS('http://localhost:9999/point');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, function (frame) {
            setConnected(true);
            console.log('Connected:' + frame);
            <!--订阅/topic/greeting-->
            stompClient.subscribe('/topic/greeting', function (response) {
                showResponse(JSON.parse(response.body).responseMessage);
            });
            <!--订阅/app/subscribe-->
            stompClient.subscribe('/app/subscribe', function (response) {
                showResponse(JSON.parse(response.body).responseMessage);
            });
        });
    }

    function disconnect() {
        if (stompClient != null) {
            stompClient.disconnect();
        }
        setConnected(false);
        console.log('Disconnected');
    }

    function sendName() {
        var name = $('#name').val();
        console.log('name:' + name);
        <!--向目的地/app/greeting发送消息,对应服务端@MessageMapping注解的方法来处理-->
        stompClient.send("/app/greeting", {}, JSON.stringify({'name': name}));
    }

    function showResponse(message) {
        $("#response").html(message);
    }
    function showCallback(message) {
        $("#callback").html(message);
    }
</script>
</body>
</html>
```

### 测试结果

_\[配图已丢失: websocker1.png\]_

页面上点击连接后，会先连接上 `/point`端点，然后同时订阅 `/topic/greeting` 和 `/app/subscribe` ，输入名字点击发送，将向 `/greeting` 的URL发送消息，然后服务器响应消息到 `/topic/greeting`

源代码: [https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-websocket](https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-websocket)

## 参考资料 & 鸣谢

*   [WebSocket 教程](http://www.ruanyifeng.com/blog/2017/05/websocket.html)
*   [spring 实战第4版](https://book.douban.com/subject/26767354/)
*   [SpringBoot系列 - 集成WebSocket实时通信](https://www.xncoding.com/2017/07/15/spring/sb-websocket.html)
