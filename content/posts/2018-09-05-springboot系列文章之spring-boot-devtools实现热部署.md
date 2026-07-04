---
title: "springboot系列文章之spring-boot-devtools实现热部署"
date: 2018-09-05
slug: "springboot系列文章之spring-boot-devtools实现热部署"
tags: ["springboot"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/devtools.png"
  - "http://osvtz719h.bkt.clouddn.com/registry.png"
  - "http://osvtz719h.bkt.clouddn.com/compiler.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 什么是热部署?](#什么是热部署)
3.  [3. spring-boot-devtools实现热部署](#spring-boot-devtools实现热部署)
    1.  [3.1. 在pom.xml 里添加 spring-boot-devtools依赖](#在pom-xml-里添加-spring-boot-devtools依赖)
    2.  [3.2. 打开 IDEA 的自动编译功能](#打开-IDEA-的自动编译功能)
    3.  [3.3. 排除静态资源文件](#排除静态资源文件)
    4.  [3.4. 关闭自动重启](#关闭自动重启)
4.  [4. 小结](#小结)

## 前言

实际开发过程中，修改应用的业务逻辑时常常需要重启应用，这显得非常繁琐，降低了开发效率，所以热部署对于开发来说显得十分必要了

## 什么是热部署?

> 应用启动后会把编译好的Class文件加载到虚拟机中，正常情况下载项目修改了源文件是需要全部重新编译并加载(需要重启应用)，而热部署就是监听 Class 文件的变动，只把发生修改的Class重新加载，而不是重启应用。

## spring-boot-devtools实现热部署

### **在pom.xml 里添加 `spring-boot-devtools`依赖**

```xml
<!--热部署依赖-->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <optional>true</optional>
</dependency>
```

注意这一点: `<optional>true</optional>`。官网的解释如下:

> Developer tools are automatically disabled when running a fully packaged application. If your application is launched from java -jar or if it is started from a special classloader, then it is considered a “production application”. Flagging the dependency as optional in Maven or using compileOnly in Gradle is a best practice that prevents devtools from being transitively applied to other modules that use your project

**将依赖项标记为 Maven 中的可选项是为了防止 devtools 传递性地应用于项目的其他模块**

### **打开 IDEA 的自动编译功能**

如下图所示，在自动编译的那个位置打上勾  

_\[配图已丢失: devtools.png\]_

**按下 `Ctrl+Shift+Alt+/`**,如下图步骤:  

_\[配图已丢失: registry.png\]_

  

_\[配图已丢失: compiler.png\]_

通过以上步骤就打开了 IDEA 的自动编译功能。每修改一次 源文件，IDEA就会自动编译。当然我们还可以选择手动进行编译，**使用 `Ctrl+F9`快捷键进行手动编译**。

### 排除静态资源文件

静态资源文件在改变之后有时候没必要触发应用程序重启，例如 thymeleaf 模板文件就可以实时编辑，默认情况下，更改 /META-INF/maven，/META-INF/resources，/resources，/static,  
/public或 /tempates下的资源不会触发重启，而是触发 live reload。

可以使用 `spring.devtools.restart.exclude`属性配置:  

```
spring.devtools.restart.exclude=static/**,public/**
```

### 关闭自动重启

*   application.properties中设置属性:
    
    ```
    spring.devtools.restart.enabled = false
    ```
    
*   在 `main`方法中设置环境变量:
    
    ```java
    public static void main(String[] args) {
        System.setProperty("spring.devtools.restart.enabled", "false");
        SpringApplication.run(App.class, args);
    }
    ```
    

## 小结

通过以上步骤就可以实现 热部署功能了，非常利于开发。
