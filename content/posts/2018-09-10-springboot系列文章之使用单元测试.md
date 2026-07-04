---
title: "springboot系列文章之使用单元测试"
date: 2018-09-10
slug: "springboot系列文章之使用单元测试"
tags: ["springboot"]
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. Service单元测试](#Service单元测试)
3.  [3. Controller的单元测试](#Controller的单元测试)
    1.  [3.1. 第一种使用模拟环境进行测试](#第一种使用模拟环境进行测试)
        1.  [3.1.1. 使用MockMvcBuilder构建MockMvc对象](#使用MockMvcBuilder构建MockMvc对象)
    2.  [3.2. 第二种使用真实Web环境进行测试](#第二种使用真实Web环境进行测试)
4.  [4. 单元测试回滚](#单元测试回滚)
5.  [5. 小结](#小结)
6.  [6. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

springboot提供了 `spirng-boot-starter-test`以供开发者使用单元测试，在引入 `spring-boot-starter-test`依赖后：  

```xml
<dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
</dependency>
```

其中包含以下几个库:

*   Junit ——常用的单元测试库
*   Spring Test & Spring Boot Test ——对Spring应用的集成测试支持
*   AssertJ——一个断言库
*   Hamcrest—— 一个匹配对象的库
*   Mockito—— 一个Java模拟框架
*   JSONassert—— 一个针对JSON的断言库
*   JsonPath—— 用于JSON的XPath

下面我们将从Service层和Controller层的角度来简单介绍下单元测试

## Service单元测试

在SpringBoot 2.0中，创建一个Service的单元测试，代码如下:  

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserServiceImplTest {
    @Autowired
    private UserService userService;
    @Test
    public void insertUser() {
        User user = new User();
        user.setUsername("li ning");
        user.setPassword("123456");
        userService.insertUser(user);
    }
}
```

上面的测试非常简单，主要需要注意两个注解: `@RunWith` 和`@SpringBootTest`

*   **@RunWith**: 该注解标签是Junit提供的，用来说明此测试类的运行者，这里用了`SpringRunner`,它实际上继承了 `SpringJUnit4ClassRunner`类，而 `SpringJUnit4ClassRunner`这个类是一个针对Junit 运行环境的自定义扩展，用来标准化在Springboot环境下Junit4.x的测试用例
*   **@SpringBootTest** 为 springApplication创建上下文并支持SpringBoot特性

使用`@SpringBootTest`的`webEnvironment`属性定义运行环境:

*   **Mock(默认)**: 加载WebApplicationContext 并提供模拟的web环境 Servlet环境，使用此批注时，不会启动嵌入式服务器
*   **RANDOM\_PORT**: 加载WebServerApplicationContext 并提供真实的web环境，嵌入式服务器，**监听端口是随机的**
*   **DEFINED\_PORT**: 加载WebServerApplicationContext并提供真实的Web环境，嵌入式服务器启动并监听定义的端口(来自 application.properties或默认端口 8080)
*   **NONE**: 使用SpringApplication加载ApplicationContext 但不提供任何Web环境

## Controller的单元测试

首先创建一个Controller，代码如下:  

```java
@RestController
public class UserController {
    @Autowired
    private UserService userService;
    @PostMapping("/user")
    public String userMapping(@RequestBody User user){
        userService.insertUser(user);
        return "ok";
    }
}
```

然后创建Controller的单元测试，一般有两种创建方法。

### 第一种使用模拟环境进行测试

默认情况下，@SpringBootTest 不会启动服务器，如果需针对此模拟环境测试Web端点，可以如下配置 MockMvc:  

```java
@RunWith(SpringRunner.class)
@SpringBootTest
@AutoConfigureMockMvc
public class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;
    @Test
    public void userMapping() throws Exception {
        String content = "{\"username\":\"pj_mike\",\"password\":\"123456\"}";
        mockMvc.perform(MockMvcRequestBuilders.request(HttpMethod.POST, "/user")
                        .contentType("application/json").content(content))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().string("ok"));
    }
}
```

这里有一个 **@AutoConfigureMockMvc**注解，该注解表示启动测试的时候自动注入 **MockMvc**,而这个**MockMvc**有以下几个基本的方法:

*   `perform` : 执行一个RequestBuilder请求，会自动执行SpringMVC的流程并映射到相应的控制器执行处理。
*   `andExpect`: 添加RequsetMatcher验证规则，验证控制器执行完成后结果是否正确
*   `andDo`: 添加ResultHandler结果处理器，比如调试时打印结果到控制台
*   `andReturn`: 最后返回相应的MvcResult,然后进行自定义验证/进行下一步的异步处理

> 这里有一个小技巧，一般来说对于一个controller中往往有不止一个Request请求需要测试，敲打MockMvcRequestBuilders与MockMvcResultMatchers会显得比较繁琐，有一个简便的方法就是将这两个类的方法使用 `import static`静态导入，然后就可以直接使用两个类的静态方法了。然后代码就变成如下所示:  
> 
> ```java
> ...
> import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
> import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
> @RunWith(SpringRunner.class)
> @SpringBootTest
> @AutoConfigureMockMvc
> public class UserControllerTest {
>     @Autowired
>     private MockMvc mockMvc;
>     @Test
>     public void userMapping() throws Exception {
>         String content = "{\"username\":\"pj_mike\",\"password\":\"123456\"}";
>         mockMvc.perform(request(HttpMethod.POST, "/user")
>                         .contentType("application/json").content(content))
>                 .andExpect(status().isOk())
>                 .andExpect(content().string("ok"));
>     }
> }
> ```

> 另外，如果是只想关注Web层而不是启动完整的ApplicationContext，可以考虑使用 **@WebMvcTest** 注解，该注解不能与@SpringBootTest搭配使用，而且它只关注Web层面，至于涉及到数据层的时候，需要引入相关依赖，关于这个注解更多的介绍请参阅官方文档: [https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-testing-spring-boot-applications-testing-autoconfigured-mvc-tests](https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-testing-spring-boot-applications-testing-autoconfigured-mvc-tests)

#### 使用MockMvcBuilder构建MockMvc对象

除了上面用 @AutoConfigureMockMvc 注解直接自动注入 MockMvc的方式，我们还可以利用MockMvcBuilder来构建MockMvc对象，示例代码如下：  

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserControllerTest4 {
    @Autowired
    private WebApplicationContext web;
    private MockMvc mockMvc;

    @Before
    public void setupMockMvc() {
        mockMvc = MockMvcBuilders.webAppContextSetup(web).build();
    }
    @Test
    public void userMapping() throws Exception {
        String content = "{\"username\":\"pj_m\",\"password\":\"123456\"}";
        mockMvc.perform(request(HttpMethod.POST, "/user")
                        .contentType("application/json").content(content))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }
}
```

### 第二种使用真实Web环境进行测试

在@SpringBootTest注解中设置属性 `webEnvironment = WebEnvironment.RANDOM_PORT`,每次运行的时候会随机选择一个可用端口。我们也可以还使用 `@LoalServerPort`注解用于本地端口号。下面是测试代码:  

```java
@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class UserControllerTest3 {
    @Autowired
    private TestRestTemplate testRestTemplate;
    @Test
    public void userMapping() throws Exception {
        User user = new User();
        user.setUsername("pj_pj");
        user.setPassword("123456");
        ResponseEntity<String> responseEntity = testRestTemplate.postForEntity("/user", user, String.class);
        System.out.println("Result: "+responseEntity.getBody());
        System.out.println("状态码: "+responseEntity.getStatusCodeValue());
    }
}
```

上面的代码中有一个关键的类——**TestRestTemplate**, TestRestTemplate是Spring的RestTemplate的一种替代品，可用于集成测试，更RestTemplate的使用功能方法类似，一般用于真实web环境测试中，关于该类更加详细的用法参考官方文档: [https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-test-scope-dependencies](https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-test-scope-dependencies)

## 单元测试回滚

单元测试的时候，如果不想造成垃圾数据，可以开启事务功能，在方法或类头部添加 `@Transactional`注解即可，在官方文档中对此也有说明:

> If your test is @Transactional, it rolls back the transaction at the end of each test method by default. However, as using this arrangement with either RANDOM\_PORT or DEFINED\_PORT implicitly provides a real servlet environment, the HTTP client and server run in separate threads and, thus, in separate transactions. Any transaction initiated on the server does not roll back in this case

解读一下，在单元测试中使用 `@Transactional`注解，默认情况下在测试方法的末尾会回滚事务。然而有一些特殊情况需要注意，当我们使用 `RANDOM_PORT`或`DEFINED_PORT`这种安排隐式提供了一个真正的Servlet环境，所以HTTP客户端和服务器将在不同的线程中运行，从而分离事务，这种情况下，在服务器上启动的任何事务都不会回滚。

当然如果你想关闭回滚，只要加上 `@Rollback(false)`注解即可，`@Rollback`表示事务执行完回滚，支持传入一个value，默认true即回滚，false不回滚。

还有一种情况需要注意，就是如果你使用的数据库是MySQL,有时候会发现加了注解 `@Transactionl`也不会回滚，那么你就要查看一下你的默认引擎是不是InnoDB,如果不是就要改成 InnoDB。

MyISAM 与 InnoDB是mysql目前比较常用的两个数据库引擎，MyISAM与InnoDB的主要的不同点在于性能和事务控制上，这里简单介绍下两者的区别与转换方法：

*   **MyISAM**： MyISAM是MySQL5.5之前版本默认的数据库存储引擎，MyISAM提供高速存储和检索，以及全文搜索能力，适合数据仓库等查询频繁的应用，但**不支持事务和外键，不能在表损坏后恢复数据**
*   **InnoDB**: InnoDB是MySQL5.5版本的默认数据库存储引擎，InnoDB具有提交，回滚和崩溃恢复能力的事务安全，**支持事务和外键**，比起MyISAM,InnoDB写的处理效率差一些并且会占用更多的磁盘空间以保留数据和索引。

如果你的数据表是MyISAM引擎，由于它不支持事务，在单元测试中添加事务注解，测试方法也是不会回滚的。

**修改默认引擎**

*   查看MySQL当前默认的存储引擎
    
    ```
    mysql> show variables like '%storage_engine%';
    ```
    
*   看具体的表user表用了什么引擎（engine后面的就表示当前表的存储引擎)
    
    ```
    mysql> show create table user;
    ```
    
*   将user表修为InnoDB存储引擎
    
    ```
    mysql> ALTER TABLE user ENGINE=INNODB;
    ```
    

**注意**

这里还有一点需要注意的地方，**当我们使用Spring Data JPA时，如果没有指定MySQL建表时的存储引擎，默认情况下会使用MySQL的MyISAM**,这也是一个坑点，这种情况下，你在单元测试使用`@Transactional`注解，回滚不会起作用。

**解决方法**是将 `hibernate.dialect`属性配置成`hibernate.dialect=org.hibernate.dialect.MySQL5InnoDBDialect`,指定MySQL建表的时候使用 InnoDB引擎，示例配置文件如下:  

```yml
spring:
  jpa:
    # 数据库类型
    database: mysql
    # 输出日志
    show-sql: true
    properties:
      hibernate:
        # JPA配置
        hbm2ddl.auto: update
        # mysql存储类型配置
        dialect: org.hibernate.dialect.MySQL5InnoDBDialect
```

## 小结

上面简单总结了springboot下如何使用单元测试，关于单元测试更加详细的介绍请参阅官方文档：[https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-testing](https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-testing)

## 参考资料 & 鸣谢

*   [Spring Boot干货系列：（十二）Spring Boot使用单元测试](http://tengj.top/2017/12/28/springboot12/)
*   [springboot官方文档](https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/#boot-features-testing)
