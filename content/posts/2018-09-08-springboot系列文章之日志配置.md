---
title: "springboot系列文章之日志配置"
date: 2018-09-08
slug: "springboot系列文章之日志配置"
tags: ["springboot"]
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 日志格式](#日志格式)
3.  [3. 日志输出](#日志输出)
    1.  [3.1. 日志输出级别配置](#日志输出级别配置)
    2.  [3.2. 日志输出格式配置](#日志输出格式配置)
4.  [4. 颜色编码](#颜色编码)
    1.  [4.1. 编码对照表](#编码对照表)
5.  [5. 文件输出](#文件输出)
6.  [6. 自定义日志配置](#自定义日志配置)
    1.  [6.1. Logback配置](#Logback配置)
        1.  [6.1.1. 多环境日志输出](#多环境日志输出)
7.  [7. 小结](#小结)
8.  [8. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

> 下面的总结基本上来自网络与官方文档，这里做一个记录，方便以后查看

SpringBoot 内部采用的是 `Commons Logging`进行日志记录，但是默认配置也提供了对常用日志的支持，如： `Java Util Logging`，`Log4j`,`Log4j2`和`Logback`。每种Logger 都可以通过配置使用控制台或者文件输出日志内容。

**slf4j**

> Simple Logging Facade For Java ,它是一个针对于各类Java日志框架的统一 Facade抽象。Java日志框架众多————常用的有`Java Util Logging`，`Log4j`,`Log4j2`和`Logback`，Spring框架使用的是 Jakarta Commons Logging API(JCL)。而 slf4j定义了统一的日志抽象接口，而真正的日志实现则是在运行时决定的–它提供了各类日志框架的binding

**Logback**

> Logback是log4j框架的作者开发的新一代日志框架，它效率更高，能够适应诸多的运行环境，同时天然支持 slf4j

默认情况下SpringBoot的日志框架是 `logback`，在建立SpringBoot项目时自动导入的 `spring-boot-starter` 依赖包含了 `spring-boot-starter-logging`，该依赖内容就是 Spring Boot默认的日志框架。

## 日志格式

默认的日志输出如下:  

```java
2018-09-05 16:49:46.985  INFO 17416 --- [           main] com.pjmike.logger.LoggerApplication      : Started LoggerApplication in 7.555 seconds (JVM running for 8.677)
```

输出内容元素具体如下:

*   时间日期 —— 精确到毫秒
*   日志级别 —— ERROR,WARN,INFO,DEBUG,TRACE
*   进程ID
*   分割符 —— `---` 标识实际日志的开始
*   线程名 —— 方括号括起来(可能会截断控制台输出)
*   Logger名 —— 通常使用源代码的类名
*   日志内容

注 Logback没有FATAL级别，它会映射到ERROR

## 日志输出

`SpringBoot` 默认为我们输出的日志级别为 `INFO`,`WARN`,`ERROR`。如需要输出更多日志的时候，可以通过以下方法开启

*   命令模式配置: `java -jar app.jar --debug=true`,这种命令会被 `SpringBoot`解析，且优先级最高。
*   资源文件配置: `application.properties` 配置 `debug=true`即可。该配置只对嵌入式容器，Spring,Hibernate生效，我们自己的项目想要输出 `DEBUG`需要额外配置(配置规则：`logging.level.<logger-name>=<level>`)

### 日志输出级别配置

```
logging.level.root = WARN
logging.level.org.springframework.web = DEBUG
logging.level.org.hibernate = ERROR

# 比如 mybatis sql日志
loggging.level.org.mybatis = DEBUG
logging.level.com.pjmike.mybatis.dao = DEBUG
```

### 日志输出格式配置

*   `logging.pattern.console`: 定义输出到控制台的格式(不支持 JDK Logger)
*   `logging.pattern.file`：定义输出到文件的格式(不支持 JDK Logger)

## 颜色编码

如果终端支持 `ANSI`,默认情况下会给日志上个色，提高可读性，可以在配置文件中设置`spring.output.ansi.enabled` 来改变默认值:

*   ALWAYS：启用 `ANSI`颜色的输出
*   DETECT: 尝试检测 `ANSI` 着色功能是否可用
*   NEVER: 禁用 `ANSI` 颜色的输出

### 编码对照表

Level

Color

WARN

Yellow

FATAL,ERROR

red

INFO,DEBUG,TRACE

Green

## 文件输出

默认情况下，`SpringBoot`仅将日志输出到控制台，不会写入到日志文件中，如果除了控制台输出之外还想写日志文件，则需要在 `application.properties` 设置 `loggging.file` 或 `logging.path`属性。

*   logging.file: 将日志写入到**指定的文件**中，默认为相对路径。可以设置成绝对路径
    
    ```
    logging.file = spring-logger.log
    ```
    
*   logging.path: 将名为 `spring.log`写入到**指定的文件夹**中，如(`/var/log`)
    

一般情况下设置其中一个属性就足够了。

日志文件在达到 `10MB`时进行分割，产生一个新的日志文件(如: `spring.1.log`,`spring.2.log`)。新的日志依旧输出到 `spring.log`中去，默认情况下会记录 `ERROR`,`WARN`,`INFO`级别消息

*   logging.file.max-size: 限制日志文件的大小
*   logging.file.max-history: 限制日志保留天数

## 自定义日志配置

在官网中有如下一段描述:

> Since logging is initialized before the ApplicationContext is created, it is not possible to control logging from @PropertySources in Spring @Configuration files. The only way to change the logging system or disable it entirely is via System properties.

由于创建 ApplicationContext 之前就已经初始化日志记录了，因此无法在Spring @Configuration文件中控制来自@PropertySources的日志记录。它并不是必须通过 Spring 的配置文件控制，因此通过系统属性 `logging.config`和传统的Spring Boot外部配置文件依然可以很好的支持日志控制和管理。

根据不同的日志系统，你可以按如下规则组织配置文件名，就能被正确加载:

*   Logback: `logback-spring.xml`,`logback-spring.groovy`,`logback.xml`,`logback.groovy`
*   Log4j: `log4j-spring.properties`,`log4j-spring.xml`,`log4j.properties`,`log4j.xml`
*   Log4j2: `log4j2-spring.xml`,`log4j2.xml`
*   JDK(Java Util Logging): `logging.properties`

SpringBoot官方推荐优先使用带有 `-spring`的文件名为你的日志配置 (比如使用 `logback-spring.xml`,而不是 `logback.xml`，`logback.xml`配置加载过早，比application.properties还早，不适合进行扩展)

### Logback配置

SpringBoot 默认的日志框架是 logback，下面我们来一个简单的 `logback-spring.xml`的例子：  

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration  scan="true" scanPeriod="60 seconds" debug="false">
    <contextName>logback</contextName>
    <!--输出到控制台-->
    <appender name="console" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %contextName [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <!--输出到文件-->
    <appender name="file" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logback.%d{yyyy-MM-dd}.log</fileNamePattern>
        </rollingPolicy>
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %contextName [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="info">
        <appender-ref ref="console" />
        <appender-ref ref="file" />
    </root>
</configuration>
```

**根节点 `<configuration>`包含的属性:**

*   scan: 当此属性设置为 true时，配置文件如果发生改变，将会被重新加载，默认值为 true
*   scanPeriod: 设置监测配置文件是否有修改的时间间隔，如果没
*   debug: 当属性设置为true时，将打印出 logback内部日志信息，实时查看 logback运行状态，默认值为 false.

**根节点`<configuration>`：下面的两个属性，三个子节点**

*   属性一：设置上下文名称 `<contextName>`
    
    > 每个logger都关联到logger上下文，默认上下文名称为“default”。但可以使用设置成其他名字，用于区分不同应用程序的记录。一旦设置，不能修改,可以通过%contextName来打印日志上下文名称
    > 
    > ```
    > <contextName>logback</contextName>
    > ```
    
*   属性二: 设置变量`<property>`
    
    > 用来定义变量值的标签， 有两个属性，name和value；其中name的值是变量的名称，value的值时变量定义的值。通过定义的值会被插入到logger上下文中。定义变量后，可以使“${}”来使用变量
    > 
    > ```
    > <property name="log.path" value="/Documents/log" />
    > ```
    
*   子节点 `<appender>`
    
    > appender用来格式化日志输出节点，有两个属性，name和class,class用来指定哪种输出策略，常用就是控制台输出策略和文件输出策略
    

**控制台输出 `ConsoleAppender`**:  

```xml
<!--输出到控制台-->
<appender name="console" class="ch.qos.logback.core.ConsoleAppender">
    <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
        <level>ERROR</level>
    </filter>
    <encoder>
        <pattern>%d{HH:mm:ss.SSS} %contextName [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
</appender>
```

`<ercoder>`表示对日志进行编码:

*   %d{HH: mm:ss.SSS}——日志输出时间
*   %thread——输出日志的进程名字，这在Web应用以及异步任务处理中很有用
*   %-5level——日志级别，并且使用5个字符靠左对齐
*   %logger{36}——日志输出者的名字
*   %msg——日志消息
*   %n——平台的换行符

`ThresholdFilter`为系统定义的拦截器，例如我们用 `ThresholdFilter`来过滤 ERROR 级别以下的日志不输出到文件中。如果不用记得注释掉，不然你控制台发现没日志

**输出到文件 RollingFileAppender**:

另一种常见的日志输出到文件，随着应用的运行时间越来越长，日志也会增长的越来越多，将他们输出到同一个文件并非一个好办法.

`RolliingFileAppender`用于切分文件日志:  

```xml
<!--输出到文件-->
<appender name="file" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
        <fileNamePattern>logback.%d{yyyy-MM-dd}.log</fileNamePattern>
    </rollingPolicy>
    <encoder>
        <pattern>%d{HH:mm:ss.SSS} %contextName [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
</appender>
```

其中重要的是rollingPolicy的定义，上例中logback.%d{yyyy-MM-dd}.log定义了日志的切分方式——把每一天的日志归档到一个文件中，30表示只保留最近30天的日志，以防止日志填满整个磁盘空间。同理，可以使用%d{yyyy-MM-dd\_HH-mm}来定义精确到分的日志切分方式。1GB用来指定日志文件的上限大小，例如设置为1GB的话，那么到了这个值，就会删除旧的日志

*   子节点二`<root>`
    
    > root节点是必选节点，用来指定最基础的日志输出级别，只有一个level属性。
    

level:用来设置打印级别，大小写无关：TRACE, DEBUG, INFO, WARN, ERROR, ALL 和 OFF，不能设置为INHERITED或者同义词NULL。  
默认是DEBUG。

可以包含零个或多个元素，标识这个appender将会添加到这个logger。

```xml
<root level="debug">
    <appender-ref ref="console" />
    <appender-ref ref="file" />
</root>
```

*   子节点三 `<logger>`

> 用来设置某一个包或者具体的某一个类的日志打印级别，以及指定。仅有一个name属性，一个可选的level和一个可选的 addtivity属性

*   name: 用来指定受此 logger 约束的**某一个包或者具体的某一个类**
*   level: 用来设置打印级别，大小写无关: TRACE,DEBUG,INFO,WARN，ERROR,ALL和OFF。，还有一个特俗值INHERITED或者同义词NULL，代表强制执行上级的级别。如果未设置此属性，那么当前logger将会继承上级的级别。(**这里的上级就是上面提到的 root**)
*   additivity: 是否向上级logger传递打印信息，默认为true。

**logger在实际使用的时候有两种情况**：

1.  在代码中使用：
    
    ```java
    @RestController
    public class HelloController {
        private Logger logger = LoggerFactory.getLogger(HelloController.class);
        @RequestMapping("/index")
        public String index() {
            logger.trace("日志输出 trace");
            logger.debug("日志输出 debug");
            logger.info("日志输出 info");
            logger.warn("日志输出 warn");
            logger.error("日志输出 error");
            return "index";
        }
    }
    ```
    
2.  在xml文件中使用，例子如下：
    
    ```xml
    <logger name="com.pjmike.controller.HelloController" level="WARN" additivity="false">
        <appender-ref ref="console"/>
    </logger>
    ```
    

#### 多环境日志输出

有时候我们需要在不同的环境(prod：生产环境，test: 测试环境，dev: 开发环境)来定义不同的日志输出，这类情况一般有两种做法:

*   第一种就是为每一种环境都创建一个对应日志配置文件，然后再其对应环境的application.properties指定 `logging.cofig`属性
*   第二种就是使用扩展属性 `springProfile`与 `springProperty`

**springProfile**

> `<springProfile>`标签使我们让配置文件更加灵活，它可以选择性的包含或排除部分配置  
> 
> ```xml
> <!--注意以下这种情况必须配置spring.profiles.active属性-->
> <springProfile name="dev">
>     <!-- 开发环境时激活 -->
> </springProfile>
> 
> <springProfile name="dev,test">
>     <!-- 开发，测试的时候激活-->
> </springProfile>
> 
> <springProfile name="!prod">
>     <!-- 当 "生产" 环境时，该配置不激活-->
> </springProfile>
> ```

**例子**  

```xml
<springProfile name="dev">
        <!--开发环境时激活-->
        <root level="debug">
            <appender-ref ref="console"/>
        </root>
</springProfile>
<springProfile name="test">
        <root level="info">
            <appender-ref ref="file"/>
            <appender-ref ref="console"/>
        </root>
</springProfile>
```

**springProperty**

> `<springProperty>`标签可以让我们在 Logback中使用 Spring Environment中的属性。如果想在 `logback-spring.xml`中回读 `application.properties`配置的值时，这是一个非常好的解决方案  
> 
> ```xml
> <!-- 读取 spring.application.name 属性来生成日志文件名
> 	scope：作用域
> 	name：在 logback-spring.xml 使用的键
> 	source：application.properties 文件中的键
> 	defaultValue：默认值
>  -->
> <springProperty scope="context" name="logName" source="spring.application.name" defaultValue="myapp.log"/>
> 
> <appender name="file" class="ch.qos.logback.core.rolling.RollingFileAppender">
>     <file>logs/${logName}.log</file>
> </appender>
> ```

## 小结

以上总结也参考了一些大佬的教程，关于日志配置更多的细节可以参阅 官方文档: [https://docs.spring.io/spring-boot/docs/2.0.1.RELEASE/reference/htmlsingle/#boot-features-custom-log-configuration](https://docs.spring.io/spring-boot/docs/2.0.1.RELEASE/reference/htmlsingle/#boot-features-custom-log-configuration)

PS: 有时候我们会觉得在每个类中写Logger会很繁琐，这里推荐一款插件叫做 **Lombok** ,它里面有一个注解 **@Slf4j** 能够实现Logger的功能，非常好用，关于**Lombok**的详细介绍参照文章: [http://t.cn/RS0UdrX](http://t.cn/RS0UdrX)

## 参考资料 & 鸣谢

*   [一起来学SpringBoot | 第三篇：SpringBoot日志配置](http://blog.battcn.com/2018/04/23/springboot/v2-config-logs/)
*   [Spring Boot日志管理](http://blog.didispace.com/springbootlog/)
*   [https://docs.spring.io/spring-boot/docs/2.0.1.RELEASE/reference/htmlsingle/#boot-features-logback-extensions](https://docs.spring.io/spring-boot/docs/2.0.1.RELEASE/reference/htmlsingle/#boot-features-logback-extensions)
*   [Spring Boot干货系列：（七）默认日志logback配置解析](http://tengj.top/2017/04/05/springboot7/)
