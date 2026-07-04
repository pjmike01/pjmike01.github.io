---
title: "RabbitMQ与AMQP模型概览"
date: 2018-10-08
slug: "RabbitMQ与AMQP模型概览"
tags: ["RabbitMQ"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/p2p_queue.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/pub_sub.jpg"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/rabbitmq_amqp_model.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/exchange-direct.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/exchange-fanout.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/exchange-topic.png"
---
**Catalogue**

1.  [1. RabbitMQ 简介](#RabbitMQ-简介)
2.  [2. 消息模型](#消息模型)
3.  [3. AMQP 模型简介](#AMQP-模型简介)
4.  [4. AMQP 的基本概念](#AMQP-的基本概念)
    1.  [4.1. Exchange 和 Exchange 类型](#Exchange-和-Exchange-类型)
        1.  [4.1.1. 关于默认 Exchange](#关于默认-Exchange)
        2.  [4.1.2. Direct Exchange](#Direct-Exchange)
        3.  [4.1.3. fanout exchange](#fanout-exchange)
        4.  [4.1.4. topic exchange](#topic-exchange)
        5.  [4.1.5. header exchange](#header-exchange)
    2.  [4.2. Queue](#Queue)
        1.  [4.2.1. 队列名](#队列名)
        2.  [4.2.2. 持久队列](#持久队列)
        3.  [4.2.3. 队列的绑定](#队列的绑定)
    3.  [4.3. 消费者](#消费者)
        1.  [4.3.1. 消息的 ACK](#消息的-ACK)
        2.  [4.3.2. 拒绝消息](#拒绝消息)
        3.  [4.3.3. 预读消息](#预读消息)
    4.  [4.4. 连接](#连接)
    5.  [4.5. 通道 (Channel)](#通道-Channel)
    6.  [4.6. 虚拟主机(vhost)](#虚拟主机-vhost)
    7.  [4.7. 消息属性和有效载荷(消息主体)](#消息属性和有效载荷-消息主体)
5.  [5. 小结](#小结)
6.  [6. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## RabbitMQ 简介

**RabbitMQ是采用 Erlang语言实现AMQP协议的消息中间件，AMQP全称是 Advanced Message Queue Protocolg，高级消息队列协议**。它是应用层协议的一个开放标准，为面向消息的中间件设计，基于此协议的客户端与消息中间件可传递消息，**并不受产品、开放语言等条件的限制**。

## 消息模型

所有MQ(消息中间件)一般有两种传递模式：**点对点模式和发布/订阅模式**。

点对点模式是基于队列的，消息生产者创建消息，然后发送消息给队列，消费者订阅队列，并从队列中获取消息。模型如下图所示:

_\[配图已丢失: p2p\_queue.png\]_

点对点模型的特点：

*   queue 不能存储已经消费的消息，消费者不可能消息到已经被消费的消息
*   每个消息只有一个消费者和一个生产者
*   生产者发消息和消费者消费消息是异步解耦的
*   消费者接收到消息后，需要发送ACK确认。

发布订阅模式定义了如何向一个内容节点发送和订阅消息，消息发送者将消息发送到某一主题(Topic)上，消息订阅者从主题中订阅消息。发布/订阅在一对多广播时使用。模型如图所示：

_\[配图已丢失: pub\_sub.jpg\]_

发布/订阅模型的特点:

*   每条消息都可以有多个消费者
*   针对某个Topic，消息者必须订阅后才可以消息它的消息
*   Topic中的消息可被重复消费

## AMQP 模型简介

RabbitMQ是AMQP协议的一个开源实现，其内部模型实际上也是 AMQP的内部模型，如下图所示：

_\[配图已丢失: rabbitmq\_amqp\_model.png\]_

AMQP模型的工作流程如下：消息(Message) 被发布者 (publisher) 发送给交换机(exchange)，交换机常常被比喻成邮局或者邮箱，然后交换机将收到的消息根据路由规则分发给绑定的队列(queue)，最后AMQP代理会将消息投递给订阅此队列的消费者，或者消费者按照需求从队列中拉取消息。

由于网络的不可靠，接收消息的应用也有可能在处理消息的时候失败，基于此原因，AMQP模型中有一个消息确认的概念：当一个消息从队列中投递给消费者后，消息者会通知一下消息代理(Broker),这个可以是自动的也可以是手动的。当”消息确认”被启用的时候，消息代理不会完全将消息从队列中删除，直到它收到来自消费者的确认回执（ACK)。

在AMQP中，为什么不直接将消息传到队列中，而是先通过 Exchange转发呢？在网上看到一则还不错的回答：

> AMQP协议中的核心思想就是生产者和消息者隔离，生产者从不直接将消息发送给队列。生产者通常不知道是否一个消息会被发送到队列中，只是将消息发送到一个交换机。先由 Exchange 来接收，然后 Exchange 按照特定的路由规则转发到 Queue 进行存储。

## AMQP 的基本概念

### Exchange 和 Exchange 类型

交换器，生产者将消息发送到交换器，交换器根据路由规则将消息路由一个或多个队列中。而路由规则受 Exchange 的类型和绑定(binding) 关系的影响。AMQP 0-9-1 broker 提供了如下 四个 exchange 类型：

类型

默认预定义的名字

Direct Exchange

空字符串和 amq.direct

Fanout Exchange

amq.fanout

Topic Exchange

amq.topic

Headers Exchange

amq.match （在 RabbitMQ 中，额外提供 amq.headers)

每个Exchange 都有如下几个属性：

*   **Name** : Exchange的名字
*   **Durability**: 是否是持久的 Exchange，当为真时，broker 重启后也会保留 此 Exchange，反之，broker重启后 Exchange 不存在
*   **Auto-delete**: 当为真时，如果所有绑定的 Queue 都不再使用时，此 Exchange 会自动删除
*   **Arguments**: 可选属性，由插件和消息代理的特定功能使用

#### 关于默认 Exchange

默认的 exchange 是一个由 broker 预创建的 匿名的 (即名字为空字符串) direct Exchange，对于简单的程序来说，默认的 exchange 有一个实用的属性： 如果没有显示的绑定 Exchange ,那么 创建 的每个 queue 都会自动绑定到这个默认的 exchange中，并且此时这个 queue的route key 就是这个 queue的名字。

下面举个例子来说明：

**发送端**：  

```java
public class RabbitmqProducer0 {
    private static final String QUEUE_NAME = "hello";
    private static final String IP_ADDRESS = "127.0.0.1";
    /**
     * RabbitMQ服务端默认端口号为5672
     */
    private static final int PORT = 5672;

    public static void main(String[] args) throws IOException, TimeoutException {
        //连接工厂
        ConnectionFactory factory = new ConnectionFactory();
        //设置ip
        factory.setHost(IP_ADDRESS);
        //设置端口
        factory.setPort(PORT);
        //设置账号
        factory.setUsername("root");
        //设置密码
        factory.setPassword("root");
        //创建连接
        Connection connection = factory.newConnection();
        //创建信道
        Channel channel = connection.createChannel();
        channel.queueDeclare(QUEUE_NAME, false, false, false, null);

        String message = "hello world ";
        channel.basicPublish("", QUEUE_NAME, new AMQP.BasicProperties.Builder().contentType("text/plain").deliveryMode(2).priority(1).userId("root").build(), message.getBytes()
        );
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        //关闭资源
        channel.close();
        connection.close();
    }
}
```

**接收端**：  

```java
public class RabbitmqConsumer0 {
    private static final String QUEUE_NAME = "hello";
    private static final String IP_ADDRESS = "39.106.63.214";
    private static final int PORT = 5672;

    public static void main(String[] args) throws IOException, TimeoutException, InterruptedException {
        Address[] addresses = new Address[]{
                new Address(IP_ADDRESS, PORT)
        };
        ConnectionFactory factory = new ConnectionFactory();
        factory.setUsername("root");
        factory.setPassword("root");
        Connection connection = factory.newConnection(addresses);
        //创建信道
        final Channel channel = connection.createChannel();
        Consumer consumer = new DefaultConsumer(channel) {
            @Override
            public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body) throws IOException {
                System.out.println("recv message: " + new String(body));
                try {
                    TimeUnit.SECONDS.sleep(5);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                //消费者显示调用Basic.Ack命令
                //deliveryTag可以看做是消息的编号，它是一个位的长整型值
                channel.basicAck(envelope.getDeliveryTag(), false);
            }
        };
        //可以指定autoAck为false,RabbitMQ会等待消费者显式地回复确认信号后才从内存中移去消息
        channel.basicConsume(QUEUE_NAME, consumer);
        TimeUnit.SECONDS.sleep(5);
    }
}
```

在上面的例子中，我们没有定义Exchange,也没有显示地将 queue 绑定到 exchange 中，因此 名为 “hello” 的queue 会自动绑定到默认的 exchange，即名字为空字符串的 exchange中。并且在这个默认的 exchange中，其 route key 和 queue名字一致。简言之，消息就以 route key为 “hello” 投递到默认的 exchange中，并被路由到 “hello” 这个queue中。

#### Direct Exchange

direct exchange 根据消息携带的 routing key 将消息投递到不同的 queue中，direct exchange 适用于消息的单播发送。工作流程如下：

*   将一个队列绑定到某个交换机上，同时赋予该绑定 一个 route key。
*   当一个携带 route key为R 的消息被发送到 direct exchange 时，exchange 会将消息路由到 绑定值同样为 R 的队列。**注意Route Key和绑定值要完全匹配才行**。

direct exchange 经常用于在 多个 worker 中分配任务，当这样做时，需注意，在AMQP 0-9-1中，消息的负载均衡发生在 consumer之间，而不是在 queue之间。

direct exchange 图示：

_\[配图已丢失: exchange-direct.png\]_

#### fanout exchange

一个 fanout exchange 会将消息分发给所有绑定到此 exchange 的queue中，不管 queue中的 route key。如果有 N 个 Queue 绑定到 一个 fanout exchange 时，那么此时 exchange 收到消息时，会将此消息分发到 这 N 个 queue中，由于此性质， fanout exchange 也常用消息的广播。

fanout exchange图示：

_\[配图已丢失: exchange-fanout.png\]_

#### topic exchange

topic exchange 会根据 route key 将消息分发到与此消息的 route key **相匹配**的并且绑定此exchange的一个或多个 queue。这里的**“相匹配”**与 direct exchange的完全匹配的路由规则不一样，topic exchange 在匹配规则上进行了扩展，规则如下：

*   RoutingKey（路由键）为一个点号 “.” 分隔的字符串，如 “com.rabbitmq.client”、”java.util.concurrent”、”com.hidden.client”等
*   BindingKey（绑定键) 和 RoutingKey一样也是点号 “.” 分隔的字符串
*   BindingKey （绑定键） 中可以存在两种 特殊字符串 “_“ 和 “#” ，用于做模糊匹配，其中 “ # “ 用于匹配一个单词，”_ “用于匹配多个单词

topic exchange 经常用于实现 publish/subscribe模型，即消息的多播模型。前面介绍消息模型也曾提到过消息中间件一般有两种模式：点对点模式和发布/订阅模式。这里的Topic Exchange就适用于发布/订阅模型。RabbitMQ的一个原则就是，消息不能直接投递到 Queue中，必须先将消息投递到 Exchange中，然后由Exchange 按照路由规则将消息投递到对应的 Queue中。至于点对点模型就可以用 Direct Exchange来实现，利用完全匹配的路由规则。

topic exchange 图示：

_\[配图已丢失: exchange-topic.png\]_

#### header exchange

header exchange 不依赖于路由器的匹配规则来路由消息，而是根据发送的消息内容中的 headers 属性进行匹配。

### Queue

Queue: 队列，是RabbitMQ的内部对象，用于存储消息，RabbitMQ中的消息只能存储在队列中。它有几个重要的属性：

*   `Name`: 名字
*   `Durable`: 是否是持久的，当为真时，即使消息代理 重启时，此 queue 也不会被删除
*   `Exclusive`: 是否是独占的，当为真时，表示此 queue只能有一个消费者，并且当此消费者的连接断开时，此 queue 会被删除
*   `Auto-delete`: 当为真时，此队列会在最后一个消费者取消订阅时被删除
*   `Arguments`: 可选属性，由插件和消息代理的特定功能使用，例如消息TTL、队列长度限制等

在使用一个队列时，需要先进行声明，如果我们声明的队列不存在，那么 broker 会自动创建它，但是如果队列已经存在，我们需要注意的是我们声明的队列的属性和已存在的的队列的属性是否一致，如果一致，则不会有任何问题，如果前后不一致，那就会 `PRECONDITION_FAILED`错误(错误码 406)

#### 队列名

AMQP的队列名 不能为 “amq.” 开头，因为这样的队列名是 AMQP broker 内部所使用的，当我们使用了这样的队列名时，那么会有一个 `ACCESS_REFUSED` 错误 （错误码为 403）

#### 持久队列

持久队列会被持久化到磁盘中去，因此即使 broker 重启了，持久队列依然存在。持久队列和消息的持久化不同，当broker 重启时，持久队列会自动重新声明，而只有队列中的持久化消息(persistent message) 才会被恢复

#### 队列的绑定

队列的绑定关系是 exchange 用于消息路由的规则，即一个 exchange 能够将消息路由到某个队列的前提是队列已经绑定到这个 exchange中了，当队列绑定到一个 exchange中时，我们设置了一个 route key，或者叫做绑定键，这个key 会被 direct exchange 和 topic exchange 作为额外的路由信息使用。

当exchange 没有任何的 queue 绑定时，那么此时会根据消息的属性来决定 是将此消息丢弃还是返回给生产者。

### 消费者

AMQP 0-9-1 支持两种消息分发模式：

*   push模式，即broker 主动推送消息给 消费者
*   pull模式，即消费者主动从 broker 中拉取消息

在push模式中，消费者订阅一个消息主题，当有消息传递到消息主题时，broker主动将消息推送给订阅该主题的所有消费者。每个消费者都有一个唯一的标识符，即 consumer tag。我们也可以用这个 tag来取消一个消费者对某个主题的订阅。push模式下一般使用 Channel类的 `basicConsume`方法：  

```java
String basicConsume(String queue, Consumer callback) throws IOException;

String basicConsume(String queue, DeliverCallback deliverCallback, CancelCallback cancelCallback) throws IOException;

String basicConsume(String queue, DeliverCallback deliverCallback, ConsumerShutdownSignalCallback shutdownSignalCallback) throws IOException;
...
```

该方法有几种重载形式，更多的信息可以参阅 API文档。

而pull（拉）模式，消费者主动从 broker 中拉取消息，通过 `channel.basicGet`方法可以单条地获取消息，其返回值是 `GetResponse`：  

```java
GetResponse basicGet(String queue, boolean autoAck) throws IOException;
```

其中 queue 代表队列的名称，如果设置 autoAck 为 true，即消息自动ACK模式，为false,则为消息手动确认模式，同样需要调用 `channel.basicAck`来确认消息已被成功接收。下面将仔细阐述消息的ACK.

#### 消息的 ACK

AMQP 0-9-1 有两种消息 ACK 模式：

*   自动 ACK 模式
*   手动 ACK 模式

**在自动 ACK 模式下，当 broker 发送消息成功后，会立即将此消息 从消息队列中 删除，而不会消费者的 ACK回复**。示例程序如下：  

```java
Address[] addresses = new Address[]{
        new Address(IP_ADDRESS, PORT)
};
ConnectionFactory factory = new ConnectionFactory();
factory.setUsername("root");
factory.setPassword("root");
Connection connection = factory.newConnection(addresses);
//创建信道
final Channel channel = connection.createChannel();
Consumer consumer = new DefaultConsumer(channel) {
    @Override
    public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body) throws IOException {
        System.out.println("recv message: " + new String(body));
        try {
            TimeUnit.SECONDS.sleep(5);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
};
channel.basicConsume(QUEUE_NAME,true,consumer);
```

在 `channel.basicConsume(String queue, boolean autoAck, Consumer callback)`设置 autoAck参数。

而在手动的 ACK模式下，当 broker 发送消息给消费者时，不会立即将此消息删除，而是需要等待消息的消费者的ACK回复后才会删除消息，因此在手动 ACK模式下，当消费者收到消息并处理完成后，需要向 broker 显示地发送 ACK指令。示例程序如下：  

```java
Address[] addresses = new Address[]{
        new Address(IP_ADDRESS, PORT)
};
ConnectionFactory factory = new ConnectionFactory();
factory.setUsername("root");
factory.setPassword("root");
Connection connection = factory.newConnection(addresses);
//创建信道
final Channel channel = connection.createChannel();
Consumer consumer = new DefaultConsumer(channel) {
    @Override
    public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body) throws IOException {
        System.out.println("recv message: " + new String(body));
        try {
            TimeUnit.SECONDS.sleep(5);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        //消费者显示调用Basic.Ack命令
        //deliveryTag可以看做是消息的编号，它是一个位的长整型值
        channel.basicAck(envelope.getDeliveryTag(), false);
    }
};
//这里还可以指定autoAck为false,RabbitMQ会等待消费者显式地回复确认信号后才从内存中移去消息
channel.basicConsume(QUEUE_NAME,consumer);
```

在手动 ACK模式下，如果消费者 因为意外的 crash 而没有发送 ACK 给 broker,那么此时 broker会将消息转发给其他的消费者 (如果此时没有消费者了，那么 broker 会缓存 此消息，直到有新的消费者注册)

#### 拒绝消息

当一个 消费者处理消息失败或者此时不能处理消息时，那么可以给 broker 发送一个拒接消息的指令，并且可以要求 broker 丢弃或者重新分发此消息。不过需要的注意的是，如果此时只有一个消费者，那么此时消费者拒收消息并要求 broker 重新分发此消息时，那么就会造成此消息不断的分发和拒收，形成了死循环。拒收的方法如下：  

```java
void basicReject(long deliveryTag, boolean requeue) throws IOException;
```

通过调用 `channel.basicReject`方法来告诉 RabbitMQ拒绝某个消息。其中 `deliveryTag` 可以看做是消息的编号，它是一个 64位的长整型值。如果 `requeue` 为 true, **broker会重新将这条消息存入 队列**，以便发送给下一个订阅的消费者。如果为false,则 broker**会立即把消息从队列中移除，而不会把它发送给新的消费者**。

#### 预读消息

通过 预读消息机制，消费者可以一次性批量取出消息，然后在处理后对这些消息进行统一的 ACK,这样可以提高消息的吞吐量。不过需要注意的是，RabbitMQ 仅支持 channel级别的预读消息的数量配置，不支持基于连接的预读消息数量配置。

### 连接

AMQP的连接是长连接，它是一个使用 TCP作为可靠传输的应用层协议。AMQP使用认证机制并且体用 TLS(SSL) 保护。当一个应用不再需要连接到 AMQP代理的时候，需要优雅的释放掉AMQP连接，而不是直接将TCP连接关闭。

### 通道 (Channel)

有些应用需要与 AMQP代理(Broker)建立多个连接，无论怎样，同时开启多个 TCP连接都是不合适的，因为这样做会消耗掉过多的系统资源并且使得防火墙的配置更加困难。AMQP 0-9-1提供了 Channel 来处理多个连接，可以把Channel理解为 共享 一个TCP连接的多个轻量化连接。（PS:这里让我想到了多路复用模型，原理相似）

在涉及多线程/进程的应用中，为每个线程/进程开启一个通道 (channel) 是很常见的，并且这些通道不能被线程/进程共享。

### 虚拟主机(vhost)

为了在一个单独的代理上实现多个隔离的环境(用户、用户组、交换机、队列等)，AMQP提供了一个 虚拟主机 (virtual hosts -vhosts)的概念。这与 虚拟机的概念相似，这为AMQP提供了完全隔离的环境。当连接被建立时，AMQP客户端指定使用哪个虚拟主机。

### 消息属性和有效载荷(消息主体)

AMQP模型中的消息 (Message)对象是带有 属性(Attributes)的。有些属性非常常见，例如：

*   `Content type`: 内容类型
*   `Content encoding`: 内容编码
*   `Routing Key`: 路由键
*   `Delivery mode`: 投递方式(持久化 or 非持久化)
*   `Message priority`: 消息优先权
*   `Message publishing timestamp`: 消息发布的时间戳
*   `Expiration period`: 消息的有效期
*   `Publisher application id`: 发布应用的id

有些属性是被 AMQP代理所使用的，比如 `Routing Key`，但是大多数是对给接收消息的消费者使用的，有些属性是可选为做消息头的。它们与HTTP协议的 `X-headers`很相似，比如 `Content type`、`Content encoding` 。

**AMQP的消息除属性外，还含有一个消息体，即消息实际携带的数据，它对AMQP代理不透明。broker 不会检查或修改消息体，但是消息可以只包含属性而不携带消息体**。

## 小结

本文参考了 [AMQP 0-9-1 Model Explained](https://www.rabbitmq.com/tutorials/amqp-concepts.html#messages)官方文档及其相关译本，果然，官方文档是最权威的，也解决了我之前对于RabbitMQ的很多疑惑。这里参照网上资料整理出来一篇文章，算是对 RabbiMQ及AMQP模型有一个大致的认识。光看文档还不够，还需多去实战才能加深对RabbitMQ的理解和认识。

## 参考资料 & 鸣谢

*   [AMQP 0-9-1 Model Explained](https://www.rabbitmq.com/tutorials/amqp-concepts.html#messages)
*   [AMQP 0-9-1 简介](http://rabbitmq.mr-ping.com/AMQP/AMQP_0-9-1_Model_Explained.html)
*   [RabbitMQ AMQP 消息模型攻略](https://segmentfault.com/a/1190000007123977)
*   [消息队列之 RabbitMQ](https://www.jianshu.com/p/79ca08116d57)
*   [RabbitMQ 实战指南](https://book.douban.com/subject/27591386/)
*   [消息模型](http://techblog.ppdai.com/2018/07/17/20180717/)
