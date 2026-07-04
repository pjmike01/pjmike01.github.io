---
title: "springboot系列文章之 集成redis 服务 (Lettuce & Jedis)"
date: 2018-09-18
slug: "springboot系列文章之-集成redis-服务-Lettuce-Jedis"
tags: ["redis", "springboot"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/redis.png"
  - "http://osvtz719h.bkt.clouddn.com/jedis_eeror.png"
  - "http://osvtz719h.bkt.clouddn.com/jedis2.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. Redis 简介](#Redis-简介)
3.  [3. Redis 连接池简介](#Redis-连接池简介)
4.  [4. Jedis vs Lettuce](#Jedis-vs-Lettuce)
5.  [5. springboot 2.0 通过 lettuce集成Redis服务](#springboot-2-0-通过-lettuce集成Redis服务)
    1.  [5.1. 导入依赖](#导入依赖)
    2.  [5.2. application.properties配置文件](#application-properties配置文件)
    3.  [5.3. 自定义 RedisTemplate](#自定义-RedisTemplate)
    4.  [5.4. 定义测试实体类](#定义测试实体类)
    5.  [5.5. 测试](#测试)
6.  [6. springboot 2.0 通过 jedis 集成Redis服务](#springboot-2-0-通过-jedis-集成Redis服务)
    1.  [6.1. 导入依赖](#导入依赖-1)
    2.  [6.2. application.properties配置](#application-properties配置)
    3.  [6.3. 配置 JedisConnectionFactory](#配置-JedisConnectionFactory)
7.  [7. 小结](#小结)
8.  [8. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

在实际项目开发过程中，相信很多人都有用到过 redis 这个NoSQL,这篇文章就详细讲讲springboot如何整合 redis

## Redis 简介

简单介绍下Redis：

> Redis是一个开源的使用 ANSI C语言编写，支持网络，可基于内存也可持久化的日志型，Key-Value数据库，并提供了多种语言的 API ,相比 `Memcached` 它支持存储的类型相对更多 (字符，哈希，集合，有序集合，列表等)，同时Redis是线程安全的。

## Redis 连接池简介

在后面 springboot 整合 redis 的时候会用到连接池，所以这里先来介绍下 Redis中的连接池:

> **客户端连接 Redis 使用的是 TCP协议，直连的方式每次需要建立 TCP连接，而连接池的方式是可以预先初始化好客户端连接，所以每次只需要从 连接池借用即可**，而借用和归还操作是在本地进行的，只有少量的并发同步开销，远远小于新建TCP连接的开销。另外，直连的方式无法限制 redis客户端对象的个数，在极端情况下可能会造成连接泄漏，而连接池的形式可以有效的保护和控制资源的使用。

下面以Jedis客户端为例，再来总结下 客户端直连方式和连接池方式的对比

优点

缺点

直连

简单方便，适用于少量长期连接的场景

1\. 存在每次新建/关闭TCP连接开销 2. 资源无法控制，极端情况下出现连接泄漏 3. Jedis对象线程不安全(Lettuce对象是线程安全的)

连接池

1\. 无需每次连接生成Jedis对象，降低开销 2. 使用连接池的形式保护和控制资源的使用

相对于直连，使用更加麻烦，尤其在资源的管理上需要很多参数来保证，一旦规划不合理也会出现问题

## Jedis vs Lettuce

redis官方提供的java client有如图所示几种：  

_\[配图已丢失: redis.png\]_

  
比较突出的是 Lettuce 和 jedis。Lettuce 和 jedis 的都是连接 Redis Server的客户端，Jedis 在实现上是直连 redis server，多线程环境下非线程安全，除非使用连接池，为每个 redis实例增加 物理连接。

Lettuce 是 一种可伸缩，线程安全，完全非阻塞的Redis客户端，多个线程可以共享一个RedisConnection,它利用Netty NIO 框架来高效地管理多个连接，从而提供了异步和同步数据访问方式，用于构建非阻塞的反应性应用程序。

**在 springboot 1.5.x版本的默认的Redis客户端是 `Jedis`实现的，springboot 2.x版本中默认客户端是用 `lettuce`实现的。**

下面介绍 `springboot 2.0`分别使用 `jedis`和 `lettuce`集成 redis服务

## springboot 2.0 通过 lettuce集成Redis服务

### 导入依赖

```xml
<dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
```

### application.properties配置文件

```
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=root
# 连接池最大连接数(使用负值表示没有限制) 默认为8
spring.redis.lettuce.pool.max-active=8
# 连接池最大阻塞等待时间(使用负值表示没有限制) 默认为-1
spring.redis.lettuce.pool.max-wait=-1ms
# 连接池中的最大空闲连接 默认为8
spring.redis.lettuce.pool.max-idle=8
# 连接池中的最小空闲连接 默认为 0
spring.redis.lettuce.pool.min-idle=0
```

### 自定义 RedisTemplate

默认情况下的模板只能支持 `RedisTemplate<String,String>`，只能存入字符串，很多时候，我们需要自定义 RedisTemplate ，设置序列化器，这样我们可以很方便的操作实例对象。如下所示：  

```java
@Configuration
public class RedisConfig {
    @Bean
    public RedisTemplate<String, Serializable> redisTemplate(LettuceConnectionFactory connectionFactory) {
        RedisTemplate<String, Serializable> redisTemplate = new RedisTemplate<>();
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        redisTemplate.setConnectionFactory(connectionFactory);
        return redisTemplate;
    }
}
```

### 定义测试实体类

```java
public class User implements Serializable {
    private static final long serialVersionUID = 4220515347228129741L;
    private Integer id;
    private String username;
    private Integer age;

    public User(Integer id, String username, Integer age) {
        this.id = id;
        this.username = username;
        this.age = age;
    }

    public User() {
    }
    //getter/setter 省略
}
```

### 测试

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class RedisTest {
    private Logger logger = LoggerFactory.getLogger(RedisTest.class);
    @Autowired
    private RedisTemplate<String, Serializable> redisTemplate;

    @Test
    public void test() {
        String key = "user:1";
        redisTemplate.opsForValue().set(key, new User(1,"pjmike",20));
        User user = (User) redisTemplate.opsForValue().get(key);
        logger.info("uesr: "+user.toString());
    }
}
```

## springboot 2.0 通过 jedis 集成Redis服务

### 导入依赖

因为 springboot2.0中默认是使用 Lettuce来集成Redis服务，`spring-boot-starter-data-redis`默认只引入了 `Lettuce`包，并没有引入 `jedis`包支持。所以在我们需要手动引入 `jedis`的包，并排除掉 `lettuce`的包，pom.xml配置如下:  

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
    <exclusions>
        <exclusion>
            <groupId>io.lettuce</groupId>
            <artifactId>lettuce-core</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
</dependency>
```

### application.properties配置

使用jedis的连接池  

```
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=root
spring.redis.jedis.pool.max-idle=8
spring.redis.jedis.pool.max-wait=-1ms
spring.redis.jedis.pool.min-idle=0
spring.redis.jedis.pool.max-active=8
```

### 配置 JedisConnectionFactory

**因为在 springoot 2.x版本中，默认采用的是 Lettuce实现的，所以无法初始化出 Jedis的连接对象 `JedisConnectionFactory`，所以我们需要手动配置并注入**：  

```java
public class RedisConfig {
    @Bean
    JedisConnectionFactory jedisConnectionFactory() {
        JedisConnectionFactory factory = new JedisConnectionFactory();
        return factory;
    }
```

但是启动项目后发现报出了如下的异常：  

_\[配图已丢失: jedis\_eeror.png\]_

redis连接失败，springboot2.x通过以上方式集成Redis并不会读取配置文件中的 `spring.redis.host`等这样的配置，需要手动配置,如下：  

```java
@Configuration
public class RedisConfig2 {
    @Value("${spring.redis.host}")
    private String host;
    @Value("${spring.redis.port}")
    private int port;
    @Value("${spring.redis.password}")
    private String password;
    @Bean
    public RedisTemplate<String, Serializable> redisTemplate(JedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Serializable> redisTemplate = new RedisTemplate<>();
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        redisTemplate.setConnectionFactory(jedisConnectionFactory());
        return redisTemplate;
    }
    @Bean
    public JedisConnectionFactory jedisConnectionFactory() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(host);
        config.setPort(port);
        config.setPassword(RedisPassword.of(password));
        JedisConnectionFactory connectionFactory = new JedisConnectionFactory(config);
        return connectionFactory;
    }
}
```

通过以上方式就可以连接上 redis了，不过这里要提醒的一点就是，在springboot 2.x版本中 `JedisConnectionFactory`设置连接的方法已过时，如图所示：

_\[配图已丢失: jedis2.png\]_

在 `springboot 2.x`版本中推荐使用 `RedisStandaloneConfiguration`类来设置连接的端口，地址等属性

然后是单元测试，与上面 `Lettuce`的例子代码一样，并且测试通过。

## 小结

上面介绍springboot 2.x版本如何通过 Jedis 和 Lettuce 来集成Redis服务，源代码地址如下：[https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-redis](https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-redis)

## 参考资料 & 鸣谢

*   [一起来学SpringBoot | 第九篇：整合Lettuce Redis](http://blog.battcn.com/2018/05/11/springboot/v2-nosql-redis/)
*   [java | Spring Boot 与 Redis 实现 Cache 以及 Session 共享](https://segmentfault.com/a/1190000012490895#spring-boot-20-redis-)
*   [spring-data-redis](https://docs.spring.io/spring-data/redis/docs/2.1.0.RC2/reference/html/#new-in-2.0.0)
*   [springboot](https://docs.spring.io/spring-boot/docs/1.5.16.RELEASE/reference/htmlsingle/#boot-features-connecting-to-redis)
*   [redis开发与运维](https://book.douban.com/subject/26971561/)
