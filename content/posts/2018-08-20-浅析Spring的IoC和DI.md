---
title: "浅析Spring的IoC和DI"
date: 2018-08-20
slug: "浅析Spring的IoC和DI"
tags: ["spring"]
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 什么是控制反转](#什么是控制反转)
3.  [3. 什么是依赖注入](#什么是依赖注入)
4.  [4. 控制反转和依赖注入的关系](#控制反转和依赖注入的关系)
5.  [5. 依赖注入的三种方式](#依赖注入的三种方式)
    1.  [5.1. 构造方法注入](#构造方法注入)
    2.  [5.2. setter方法注入](#setter方法注入)
    3.  [5.3. 接口注入](#接口注入)
6.  [6. 小结](#小结)
7.  [7. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

以前学习 Spring 框架的控制反转和依赖注入，一直很懵懂，对这两者概念和它们之间的关系没有一个清晰的认识，所以这篇文章详细去探索这被人称道的 IoC 和 DI

## 什么是控制反转

IoC的全称是Inversion of Control,中文意思就是控制反转，那到底什么是控制反转呢，首先让我们看一个例子。

假设有一个服务类ServiceA，要做`doService`这项工作，其中它想调用服务类ServiceB中的方法，要依赖于ServiceB类的服务，最直接的方法是直接在类的构造函数中新建相应的依赖类，去主动获取依赖的对象，就好比装修家，要用家具，就直接去买家具回来。这些工作都是我们主动去做的  

```java
public class ServiceA {
    private ServiceB serviceB;

    public ServiceA() {
        serviceB = new ServiceB();
    }

    public void doService() {
        System.out.println("do something..");
        serviceB.doSomething();
    }

    public static void main(String[] args) {
        ServiceA serviceA = new ServiceA();
        serviceA.doService();
    }
}
```

但是，如果我们每次用到什么依赖对象都要主动去获取，显得有些麻烦。如果有人能够在我们需要的时候将某个依赖对象送过来，那就爽了，而IoC这个概念就应运而生，将情况反转了，IoC就是提供更加简洁的方式，现在有什么，让别人送过来就可以了，变主动为被动，让别人为你服务，让被依赖的对象自动进来。

总结一下: **控制反转(IoC)实际上是一种设计思想，让别人为你服务，在Java开发中，IoC意味着将你设计好的对象交给容器控制，而不是传统的在你对象内部构造直接控制，IoC容器直接控制对象，由容器来帮忙创建及注入依赖对象，不需要我们去主动控制了。**

## 什么是依赖注入

DI-Dependency Injection，即”依赖注入”，就是将实例变量传入到一个对象中去。还有一种说法就是，由容器动态的将某个依赖关系注入到组件中去，即应用程序需要Ioc容器来提供对象需要的外部资源。

## 控制反转和依赖注入的关系

IoC和DI是什么关系呢，一种说法是是同一个概念的不同角度描述，另一种说法是，依赖注入可以看做是控制反转的一种实现方式，IoC是一种思想，DI是一种设计模式，实现IoC的模式。其实我更倾向于后者，虽然两者概念上有相似之处，但是将DI看做一种是IoC的思想的实现方式更让人容易理解。

关于IoC和DI更权威的解释，应该是大师级别的Martin Fowler的那篇文章 :[Inversion of Control Containers and the Dependency Injection pattern](http://www.martinfowler.com/articles/injection.html)

## 依赖注入的三种方式

### 构造方法注入

构造方法注入，就是被注入对象可以通过在其构造方法中声明依赖对象的参数列表，让外部IoC容器知道它需要哪些依赖对象,例如上面的服务ServiceA的例子  

```java
public class ServiceA {
    private ServiceB serviceB;

    public ServiceA(ServiceB serviceB) {
        this.serviceB = serviceB;
    }
    ...
}
```

### setter方法注入

对于JavaBean对象来说，通常会通过setXXX()和getXXX()来访问对应属性，setXXX()就称为setter方法，通过setter方法，可以更改相应的对象属性。所以当前对象只要为其依赖对象所对应的属性添加setter方法，就可以通过setter方法将相应的依赖对象设置到被注入对象中。还是以服务ServiceA为例。  

```java
public void setServiceB(ServiceB serviceB) {
        this.serviceB = serviceB;
    }
```

setter方法相对宽松，可以在对象构造完成后再注入就必须实现某个接口，这个接口提供了一个方法，用来为其注入依赖对象

### 接口注入

对于接口注入来说，如果被注入对象想要Ioc容器为其注入依赖对象，就必须实现某个接口，这个接口提供了一个方法，用来为其注入依赖对象。但是从注入方式的使用来说，接口注入是现在不提倡的一种方式，基本处于”退役”状态，因为它强制被注入对象实现不必要的接口。

## 小结

IoC 是一种可以帮助我们解耦各业务对象间依赖关系的对象绑定方式，理解Ioc和DI能够更好地帮助我们使用Spring框架。

## 参考资料 & 鸣谢

*   [Inversion of Control Containers and the Dependency Injection pattern](http://www.martinfowler.com/articles/injection.html)
*   [IoC 之 2.1 IoC基础 ——跟我学Spring3](http://jinnianshilongnian.iteye.com/blog/1413846)
*   [Spring揭秘-王福强](https://book.douban.com/subject/3897837/)
