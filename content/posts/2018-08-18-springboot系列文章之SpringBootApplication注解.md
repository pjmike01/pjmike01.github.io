---
title: "springboot系列文章之SpringBootApplication注解"
date: 2018-08-18
slug: "springboot系列文章之SpringBootApplication注解"
tags: ["springboot"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/springboot.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/importSelector.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/imports.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/8.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/loadFactory.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/auto.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/method.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. @SpringBootApplication注解](#SpringBootApplication注解)
    1.  [2.1. @Configuration](#Configuration)
    2.  [2.2. @ComponentScan](#ComponentScan)
    3.  [2.3. @EnableAutoConfiguration](#EnableAutoConfiguration)
        1.  [2.3.1. AutoConfigurationImportSelector](#AutoConfigurationImportSelector)
            1.  [2.3.1.1. 何时被执行](#何时被执行)
            2.  [2.3.1.2. 自动配置的幕后英雄:SpringFactoriesLoader](#自动配置的幕后英雄-SpringFactoriesLoader)
    4.  [2.4. SpringBootApplication注解中4个方法](#SpringBootApplication注解中4个方法)
3.  [3. 小结](#小结)
4.  [4. 参考资料](#参考资料)

## 前言

Springboot的启动类可以是非常简单，其中最关键的两部分是Annotation定义(`@SpringBootApplication`)和类定义(SpringApplication.run)，这篇文章主要分析其`@SpringBootApplication`注解,后续文章再接着分析其类定义。

```java
@SpringBootApplication
public class Application {


    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

其中参考了[《SpringBoot揭秘》](http://product.dangdang.com/23964779.html)里面的分析,也是学习总结了。

## @SpringBootApplication注解

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(
    excludeFilters = {@Filter(
    type = FilterType.CUSTOM,
    classes = {TypeExcludeFilter.class}
), @Filter(
    type = FilterType.CUSTOM,
    classes = {AutoConfigurationExcludeFilter.class}
)}
)
public @interface SpringBootApplication {
    .....
}
```

看似有这么多注解，实际上`@SpringBootApplication`是一个”三体”结构，重要的只有三个Annotation：

*   `@Configuration`
*   `@EnableAutoConfiguration`
*   `@ComponentScan`

为什么`@SpringBootApplication注解`里没有包含`@Configuration`,实际上是在`@SpringBootConfiguration`里面  

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Configuration
public @interface SpringBootConfiguration {
  	....
}
```

**@SpringBootConfiguration继承自@Configuration，二者功能也一致，标注当前类是配置类，  
并会将当前类内声明的一个或多个以@Bean注解标记的方法的实例纳入到spring容器中，并且实例名就是方法名**。

实际上如果我们使用如下的Springboot启动类，整个SpringBoot应用依然可以与之前的启动类功能对等。  

```java
@Configuration
@EnableAutoConfiguration
@ComponentScan
public class Application {


    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

下面分别说说这三个关键注解

### @Configuration

这里的`@Configuration`就是以JavaConfig形式的Spring IoC容器的配置类使用的那个`@Configuration`,所以这里的启动类标注了`@Configuration`之后，本身其实也是一个IoC容器的配置类。

以前的XML配置是这样的:  

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-3.0.xsd"
       default-lazy-init="true">
    <!--bean定义-->
</beans>
```

现在的JavaConfig配置是这样的，效果等同，标注了该注解说明就是一个配置类  

```java
@Configuration
public class Application{
    //bean定义
}
```

更多关于`@Configuration`和`@Bean`的讲解，参考文章: [使用 Java 配置进行 Spring bean 管理](https://www.ibm.com/developerworks/cn/webservices/ws-springjava/index.html)

### @ComponentScan

@ComponentScan的功能其实就是自动扫描并加载符合条件的组件或bean定义，最终将这些bean定义加载到容器中。**我们可以通过basePackages等属性指定@ComponentScan自动扫描的范围，如果不指定，则默认Spring框架实现从声明@ComponentScan所在类的package进行扫描，默认情况下是不指定的，所以SpringBoot的启动类最好放在root package下。**

### @EnableAutoConfiguration

各位是否还记得Spring框架提供的各种名字为@Enable开头的Annotation定义？比如`@EnableScheduling`,`@EnableCaching`,`@EnableMBeanExport`等，`@EnableAutoConfiguration`的理念和”做事方式”其实一脉相承，**借助`@Import`的支持，收集和注册特定场景相关的bean定义:**

*   `@EnableScheduling`是通过@Import将Spring调度框架相关的bean定义都加载到Ioc容器中。
*   `@EnableMBeanExport`是通过@Import将JMX相关的bean定义加载到Ioc容器

而@EnableAutoConfiguration也是借助@Import的帮助，**将所有符合自动配置条件的bean定义加载到Ioc容器，仅此而已**

@EnableAutoConfiguration也是一个复合Annotation，其定义如下:  

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage
@Import({AutoConfigurationImportSelector.class})
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";

    Class<?>[] exclude() default {};

    String[] excludeName() default {};
}
```

其中，最关键的要属`@Import(AutoConfigurationImportSelector.class)`,借助`AutoConfigurationImportSelector`这个类，`@EnableAutoConfiguration`可以帮助Springboot应用将所有符合条件的@configuration都加载到当前的SpringBoot创建并使用的Ioc容器  

_\[配图已丢失: springboot.png\]_

#### AutoConfigurationImportSelector

在SpringBoot1.5以前，使用的是`EnableAutoConfigurationImportSelector`，它继承自`AutoConfigurationImportSelector`，1.5以后，`EnableAutoConfigurationImportSelector`已经不再被建议使用，而是推荐使用`AutoConfigurationImportSelector`。

##### 何时被执行

现在我们已经知道了在@EnableAutoConfiguration中引入了AutoConfigurationImportSelector类，那么它是如何被执行的呢？

Springboot启动时会使用ConfigurationClassParser来解析被@Configuration修饰的配置类，然后再处理这个类内部被其他注解修饰的情况，比如@Import注解，@ComponentScan注解，@Bean注解等。

如果发现注解中存在@Import(ImportSelector)的情况下，就会创建一个相应的importSelector对象，并调用其selectImports方法，而AutoConfigurationImportSelector就是一个ImportSelector的实现类。更多关于ConfigurationClassParser的分析，参阅文章:[Spring类注册笔记](https://fangjian0423.github.io/2017/06/15/spring-bean-register-note/)

_\[配图已丢失: importSelector.png\]_

所以ConfigurationClassParser会实例化一个AutoConfigurationImportSelector 并调用它的 selectImports() 方法

_\[配图已丢失: imports.png\]_

在selectImports方法中有使用getCandidateConfigurations()这个方法，这个方法走进去，就可以看到自动配置的幕后英雄:SpringFactoriesLoader

_\[配图已丢失: 8.png\]_

##### 自动配置的幕后英雄:SpringFactoriesLoader

SpringFactoriesLoader的主要功能就是从指定的配置文件`META/spring.factories`加载配置，spring.factories是一个典型的java properties文件，配置格式为Key-Value形式，只不过Key和Value都是Java类型的完整类名。

进入loadFactoryNames()方法，就发现loadFactoryNames()读取了ClassPath下面的 META-INF/spring.factories 文件。

_\[配图已丢失: loadFactory.png\]_

在@EnableAutoConfiguration的场景中，它更多是提供一种配置查找的功能支持，即根据@EnableAutoConfiguration的完整类名org.springframework.boot.autoconfigure.EnableAutoConfiguration作为查找的key,获取对应的一组@Configuration类

_\[配图已丢失: auto.png\]_

### SpringBootApplication注解中4个方法

@SpringBootApplication不仅包括上面的三个重要注解，还包含有4个方法:

_\[配图已丢失: method.png\]_

*   `Class<?>[] exclude() default {};` 根据Class来排除特定的类加入Spring容器，传入参数是class类型
*   `String[] excludeName() default {};` 根据Class name排除特定的类加入spring容器，传入参数是class的全类名字符串数组
*   `String[] scanBasePackages() default {};`指定扫描包，参数是包名的字符串数组
*   `Class<?>[] scanBasePackageClasses() default {};`指定扫描包，参数是Class类型数组
    
    ## 小结
    
    这里总结下@SpringBootApplication中的三个重要注解的特征:
*   `@Configuration`

定义Spring Ioc容器的配置类

*   `@EnableAutoConfiguration`:

从classpath中搜寻所有META/spring.factories配置文件，并将其中`org.springframework.boot.autoconfigure.EnableAutoConfiguration`对应的配置项，也就是一个自动配置类列表加载到Ioc容器中。 而对于所有标注@Configuration的配置类，统一使用`ConfigurationClassParser`解析的。

*   `@ComponentScan`

自动扫描并加载符合条件的组件或者bean定义

## 参考资料

*   [SpringBoot揭秘](http://product.dangdang.com/23964779.html)
*   [Spring Boot干货系列：（三）启动原理解析](http://tengj.top/2017/03/09/springboot3/)
