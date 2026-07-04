---
title: "浅析 Spring 的IOC容器"
date: 2018-11-21
slug: "浅析-Spring-的IOC容器"
tags: ["Spring"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/ApplicationContext.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/BeanFactory.jpg"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/web_context.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. BeanFactory](#BeanFactory)
    1.  [2.1. BeanFactory的介绍](#BeanFactory的介绍)
    2.  [2.2. BeanFactory的对象注册](#BeanFactory的对象注册)
3.  [3. ApplicationContext](#ApplicationContext)
    1.  [3.1. ApplicationContext的介绍](#ApplicationContext的介绍)
    2.  [3.2. ApplicationContext的实现](#ApplicationContext的实现)
    3.  [3.3. Spring 中的 Context](#Spring-中的-Context)
        1.  [3.3.1. SpringBoot 中的 Context](#SpringBoot-中的-Context)
    4.  [3.4. ApplicationContext 的简单实践](#ApplicationContext-的简单实践)
        1.  [3.4.1. 基于 XML 配置文件](#基于-XML-配置文件)
        2.  [3.4.2. 基于注解方式](#基于注解方式)
        3.  [3.4.3. XML 与 Annotation 简单对比](#XML-与-Annotation-简单对比)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

在前面的文章 [浅析Spring 的IoC和DI](https://pjmike.github.io/2018/11/21/%E6%B5%85%E6%9E%90-Spring-%E7%9A%84IOC%E5%AE%B9%E5%99%A8/)中简述了 IOC和DI的基本概念和关系，总体上说，IOC 是一种可以帮助我们解耦各业务对象间依赖关系的对象绑定方式，那么Spring 提供了两种容器类型来提供支持 IOC方式。这两种类型是：

*   BeanFactory: 基础类型的IOC容器，提供完整的IOC服务支持
*   ApplicationContext: ApplicationContext是在 BeanFactory的基础之上构建的，是相对高级的容器实现，除了拥有BeanFactory的所有支持，ApplicationContext提供了其他高级特性。 ApplicationContext 和 BeanFactory的继承关系如下：

_\[配图已丢失: ApplicationContext.png\]_

可以看到 ApplicationContext 间接继承自 BeanFactory。

## BeanFactory

### BeanFactory的介绍

BeanFactory 是基础类型IoC容器，提供完整的IoC服务支持。如果没有特殊指定，默认采用**延迟初始化策略(lazy-load)**。**只有当客户端对象需要访问容器中的某个受管对象的时候，才对该受管对象进行初始化以及依赖注入工作**。

### BeanFactory的对象注册

BeanFactory,就是生产 Java Bean 的工厂，作为Spring 提供的基本的IoC容器，BeanFactory 帮助完成  
**业务对象的注册和对象间依赖关系的绑定**。

实际上，BeanFactory只是一个接口，**它负责定义如何访问容器内管理的Bean的方法，各个BeanFactory的具体实现类负责具体Bean的注册以及管理工作**。下面是BeanFactory的接口代码：  

```java
package org.springframework.beans.factory;

public interface BeanFactory {

    /**
     * 用来引用一个实例，或把它和工厂产生的Bean区分开，就是说，如果一个FactoryBean的名字为a，那么，&a会得到那个Factory
     */
    String FACTORY_BEAN_PREFIX = "&";

    /*
     * 四个不同形式的getBean方法，获取实例
     */
    Object getBean(String name) throws BeansException;

    <T> T getBean(String name, Class<T> requiredType) throws BeansException;

    <T> T getBean(Class<T> requiredType) throws BeansException;

    Object getBean(String name, Object... args) throws BeansException;

    boolean containsBean(String name); // bean是否存在

    boolean isSingleton(String name) throws NoSuchBeanDefinitionException;// 是否为单实例

    boolean isPrototype(String name) throws NoSuchBeanDefinitionException;// 是否为原型（多实例）

    boolean isTypeMatch(String name, Class<?> targetType)
            throws NoSuchBeanDefinitionException;// 名称、类型是否匹配

    Class<?> getType(String name) throws NoSuchBeanDefinitionException; // 获取类型

    String[] getAliases(String name);// 根据实例的名字获取实例的别名

}
```

下面我们来测试下一般情况下 BeanFactory接口的具体实现类情况:  

```java

// 实体类
@Component
public class Demo {
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}

//Junit测试类
@RunWith(SpringRunner.class)
@SpringBootTest
public class ApplicationTests {
    @Autowired
    private BeanFactory beanFactory;
    @Test
    public void test() {
        System.out.println("concrete factory is: " + beanFactory.getClass());
        Assert.assertTrue("Factory can't be null",beanFactory != null);
        Demo demo = (Demo) beanFactory.getBean("demo");
        System.out.println("Found the demo bean: "+demo.getClass());
    }

}
```

输出结果如下:  

```
concrete factory is: class org.springframework.beans.factory.support.DefaultListableBeanFactory
Found the demo bean: class com.pjmike.spring.Demo
```

从结果可以看出，具体工厂是 `org.springframework.beans.factory.support.DefaultListableBeanFactory`的实例。再来看看 `BeanFactory`的继承体现:

_\[配图已丢失: BeanFactory.jpg\]_

从上图可以看出，BeanFactory有三个直接子类:

*   ListableBeanFactory: 通过继承该接口可以列出所有的Bean,也可以只列出与预期类型相对应的bean
*   HierarchicalBeanFactory: 支持分层bean的管理，使BeanFactory支持双亲IOC容器的管理功能
*   AutowireCapableBeanFactory： 可以填充不受Spring 控制的 Bean

而三个类的子类体系就更多，详细的参考 Spring 源码。

再来看看之前提到的`DefaultListableBeanFactory`,它也是上图中最底层的实现类:  

```java
public class DefaultListableBeanFactory extends AbstractAutowireCapableBeanFactory
		implements ConfigurableListableBeanFactory, BeanDefinitionRegistry, Serializable {
		...
}
```

这个类其实就是 `BeanFactory`的默认实现类，一个比较通用的BeanFactory实现类，它除了间接实现 BeanFactory接口外，还实现了 **BeanDefinitionRegistry**接口，**该接口才是BeanFactory实现中担任 Bean注册管理的角色**，它抽象的定义了Bean注册的逻辑，当然具体的是实现还是靠**DefaultListableBeanFactory**这等实现类。

## ApplicationContext

### ApplicationContext的介绍

**ApplicationContext是在BeanFactory的基础上构建**的，是相对比较高级的容器实现，除了拥有 BeanFactory的所有支持，ApplicationContext还提供了其他高级特性，比如：

*   统一资源加载策略
*   国际化信息支持
*   容器内部事件发布机制

**在ApplicationContext 容器启动之后，默认全部初始化并绑定完成**，所以，对于BeanFactory来说，ApplicationContext 往往要求更多的系统资源

### ApplicationContext的实现

### Spring 中的 Context

Spring 为基本的 BeanFactory 类型容器提供了 XmlBeanFactory 实现(继承自DefaultListableBeanFactory），相应的，它也为 ApplicationContext 类型容器提供了以下几个常用的实现：

*   `org.springframework.context.support.FileSystemXmlApplicationContext`： 在默认情况下，从文件系统加载 bean 定义以及相关资源的 ApplicationContext 实现
*   `org.springframework.context.support.ClassPathXmlApplicationContext`： 在默认情况下，从Classpath 加载bean 定义以及相关资源的 ApplicationContext 实现
*   `org.springframework.web.context.support.XmlWebApplicationContext`: Spring提供的用于 Web 应用程序的 ApplicationContext 实现。

在传统的基于 XML的Spring项目中，经常会使用到上面的实现类

#### SpringBoot 中的 Context

在官方文档中给出对于一个 SpringBoot 应用它对应的Context的情况:  

_\[配图已丢失: web\_context.png\]_

*   对于 web应用，context 是 `AnnotationConfigServletWebServerApplicationContext`
*   对于 响应式应用，context 是 `AnnotationConfigReactiveWebServerApplicationContext`
*   对于普通非 web应用，context 是 `AnnotationConfigApplicationContext`

以上的 `context`实际上也是实现了 `ApplicationContext`接口

### ApplicationContext 的简单实践

我们都知道IOC容器一般有两种对象注入方式：基于XML配置文件 与 基于注解驱动的方式。下面就分别从这两个角度来看如何使用 ApplicationContext

#### 基于 XML 配置文件

1.  定义个实体类
    
    ```java
    public class User {
        private Integer id;
    
        private String username;
    
        public User(Integer id, String username) {
            this.id = id;
            this.username = username;
        }
    
        public User() {
        }
    
        public Integer getId() {
            return id;
        }
    
        public void setId(Integer id) {
            this.id = id;
        }
    
        public String getUsername() {
            return username;
        }
    
        public void setUsername(String username) {
            this.username = username;
        }
    }
    ```
    
2.  设置一个XML配置文件，声明 User Bean
    
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <beans xmlns="http://www.springframework.org/schema/beans"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
        <bean id="user" class="com.pjmike.spring.domain.User">
            <constructor-arg name="id" value="1"/>
            <constructor-arg name="username" value="pjmike"/>
        </bean>
    </beans>
    ```
    
3.  主程序
    
    ```java
    public class XmlBootStrap {
        public static void main(String[] args) {
            //构建一个 ApplicationContext 上下文
            ClassPathXmlApplicationContext context = new ClassPathXmlApplicationContext();
            //设置此应用上下文的配置路径
            context.setConfigLocations("classpath:/META-INF/spring/context.xml");
            //调用 refresh 方法，完成配置的解析、各种BeanFactoryPostProcessor和BeanPostProcessor的注册、国际化配置的初始化、web内置容器的构造
            context.refresh();
            User user = context.getBean("user", User.class);
            System.out.print("user.getName() = "+ user.getUsername());
        }
    }
    ```
    

输出结果  

```java
user.getName() = pjmike
```

#### 基于注解方式

1.  声明一个配置类
    
    ```java
    @Configuration
    public class UserConfiguration {
        @Bean(name = "user")
        public User user() {
            User user = new User();
            user.setUsername("pj");
            return user;
        }
    }
    ```
    
2.  主程序
    
    ```java
    public class AnnotationBootStrap {
        public static void main(String[] args) {
            // 构建一个 ApplicationContext 应用上下文
            AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
            //注册一个配置 Bean
            context.register(UserConfiguration.class);
            // 调用 refresh 启动容器
            context.refresh();
            User user = context.getBean("user", User.class);
            System.out.println("user.getName() = "+user.getUsername());
        }
    }
    ```
    

输出结果  

```
user.getName() = pj
```

#### XML 与 Annotation 简单对比

从上面的两个例子可以看出基于XML和基于注解注入Bean 的方式是不一样的，基于XML的应用上下文`ClassPathXmlApplicationContext`需要设置配置路径，基于注解的应用上下文`AnnotationConfigApplicationContext`需要注册一个配置Bean，但它们相同的一步就是必须要调用 `refresh()`方法，该方法可以看做是IOC容器的启动方法，它会做很多操作，比如完成配置的解析、各种BeanFactoryPostProcessor和BeanPostProcessor的注册、国际化配置的初始化、web内置容器的构造等等，不调用它，容器就无法启动。这里只是简要说明，更加详细的介绍会在后面的文章介绍。

现在是springboot盛行的阶段，基于XML配置文件的方式已经逐步被基于注解的方式所取代，如今的项目中，更多的使用 注解的方式。 关于XML与注解更详细的对比可以参阅开涛大神的文章： [http://jinnianshilongnian.iteye.com/blog/1879910](http://jinnianshilongnian.iteye.com/blog/1879910)

## 小结

上面的文章比较简单的总结了 BeanFactory 和 ApplicationContext，为后续分析Spring IOC详细的初始化过程、Spring Bean的加载等做一个铺垫

## 参考资料 & 鸣谢

*   [SpringBoot官网](https://docs.spring.io/spring-boot/docs/2.0.4.RELEASE/reference/htmlsingle/)
*   [Spring 揭秘](https://book.douban.com/subject/3897837/)
