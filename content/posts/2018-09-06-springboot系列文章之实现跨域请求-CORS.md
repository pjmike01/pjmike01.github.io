---
title: "springboot系列文章之实现跨域请求(CORS)"
date: 2018-09-06
slug: "springboot系列文章之实现跨域请求-CORS"
tags: ["springboot"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/cors.jpg"
---
**Catalogue**

1.  [1. CORS介绍](#CORS介绍)
2.  [2. CORS的工作原理](#CORS的工作原理)
    1.  [2.1. 简单请求](#简单请求)
        1.  [2.1.1. Request Headers](#Request-Headers)
        2.  [2.1.2. Response Headers](#Response-Headers)
    2.  [2.2. 非简单请求](#非简单请求)
        1.  [2.2.1. 预检请求的回应](#预检请求的回应)
3.  [3. 实现 CORS 跨域请求的方式](#实现-CORS-跨域请求的方式)
    1.  [3.1. 1.返回新的 CorsFilter(全局跨域)](#1-返回新的-CorsFilter-全局跨域)
    2.  [3.2. 2\. 重写 WebMvcConfigurer(全局跨域)](#2-重写-WebMvcConfigurer-全局跨域)
    3.  [3.3. 3\. 使用注解 (局部跨域)](#3-使用注解-局部跨域)
    4.  [3.4. 4\. 手动设置响应头(局部跨域)](#4-手动设置响应头-局部跨域)
4.  [4. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## CORS介绍

跨域资源共享向来都是热门的需求，我们可以使用 CORS 来快速实现 跨域访问，只需要在服务端进行授权即可，无需在前端添加额外的设置

简单说，CORS是一种访问机制，英文全称: Cross-Origin Resource Sharing，即我们说的跨域资源共享。**当一个资源从与该资源本身所在服务器不同的域或端口请求一个资源时，资源会发起一个跨域HTTP请求**。比如，在一个域名下的网页中，调用另一个域名中的资源。

## CORS的工作原理

CORS 实现跨域访问并不是一蹴而就的，需要借助浏览器的支持，从原理题图我们可以看到，简单的请求(通常指 `GET/POST/HEAD` 方式，并没有去增加额外的请求头信息) 直接创建了跨域请求的 `XMLHttpRequest`对象，而非简单请求(那种对服务器有特殊要求的请求，比如请求方法是 `PUT` 或`DELETE`，或者 `Content-Type`字段的类型是 `application/json`) 则要求先发送一个 **“预检”** 请求,待服务器批准后才能真正发起跨域访问请求。  

_\[配图已丢失: cors.jpg\]_

### 简单请求

> 下面分析摘自 阮一峰的 [跨域资源共享 CORS 详解](http://www.ruanyifeng.com/blog/2016/04/cors.html)

对于简单请求 (`GET/POST/HEAD`，浏览器直接发出 `CORS`请求，具体来说，就是在头信息之中，增加一个 `Origin` 字段。如下图所示：  

```
GET /cors HTTP/1.1
Origin: http://api.bob.com
Host: api.alice.com
Accept-Language: en-US
Connection: keep-alive
User-Agent: Mozilla/5.0...
```

上面的 `Origin` 字段用来说明，本次请求来自哪个源(协议+域名+端口)。服务器根据这个值，决定是否同意这次请求。

如果 `Origin` 指定的源，不在许可范围内，服务器会返回一个正常的 HTTP响应。浏览器发现，这个回应的头信息没有包含 `Access-Control-Allow-Origin` 字段，就知道错了，从而抛出一个错误，被 `XMLHttpRequest`的 `onerror`回调函数捕获。

如果 `Origin`指定的域名在许可范围内，服务器返回的响应，会多出几个头信息字段  

```
Access-Control-Allow-Origin: http://api.bob.com
Access-Control-Allow-Credentials: true
Access-Control-Expose-Headers: FooBar
Content-Type: text/html; charset=utf-8
```

下面总结下 简单请求 与 CORS 有关的请求头与响应头

#### Request Headers

*   **Origin** ：表示跨域请求的原始域

#### Response Headers

*   **Access-Control-Allow-Origin** ： 表示允许哪些原始域进行跨域访问，它的值要么是请求时 `Origin`字段的值，要么是一个 `*`,表示接受任意域名的请求
*   **Access-Control-Allow-Credentials**： 表示是否允许客户端发送 Cookie，是一个布尔值。默认情况下，Cookie不包括在 CORS 请求之中，设为 true，即表示服务器明确许可，Cookie 可以包含在请求中，一起发给服务器
*   **Access-Control-Expose-Headers**: CORS请求时，XMLHttpRequest对象的`getResponseHeader()`方法只能拿到6个基本字段，自定义的header字段是拿不到的，如果想拿到自定义的Header 字段，就必须在 `Access-Control-Expose-Headers`里面指定

### 非简单请求

非简单请求的 CORS 请求，会在正式通信之前，增加一次 HTTP查询请求，称为 “预检”请求。下面是一个预检请求的HTTP头信息:  

```
OPTIONS /cors HTTP/1.1
Origin: http://api.bob.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: X-Custom-Header
Host: api.alice.com
Accept-Language: en-US
Connection: keep-alive
User-Agent: Mozilla/5.0...
```

除了 `Origin`字段外，还包括两个特殊字段:

*   Access-Control-Request-Method: 用来列出浏览器的 CORS请求用到哪些HTTP方法
*   Access-Control-Request-Headers： 该字段是一个逗号分隔的字符串，指定浏览器CORS请求会额外发送的头信息字段，上例是X-Custom-Header

#### 预检请求的回应

服务器收到预检请求后，做出回应:  

```
HTTP/1.1 200 OK
Date: Mon, 01 Dec 2008 01:15:39 GMT
Server: Apache/2.0.61 (Unix)
Access-Control-Allow-Origin: http://api.bob.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: X-Custom-Header
Content-Type: text/html; charset=utf-8
Content-Encoding: gzip
Content-Length: 0
Keep-Alive: timeout=2, max=100
Connection: Keep-Alive
Content-Type: text/plain
```

下面总结下，预检请求下的回应的与CORS相关的请求头:

*   **Access-Control-Allow-Methods**: 逗号分隔的字符串，表明服务器支持的**所有**跨域请求的方法。注意是所有方法，不是单个浏览器请求时的那个方法，这是为了避免多次 “预检”请求
*   **Access-Control-Allow-Headers**：如果浏览器请求包括 `Access-Control-Request-Headers`字段，则 `Access-Control-Allow-Headers`是必须的，它表明服务器支持的所有头信息字段，不限于浏览器再预检中请求的字段
*   **Access-Control-Max-Age**: 该字段可选，用来指定本次预检请求的有效期，单位为秒。

## 实现 CORS 跨域请求的方式

对于 CORS的跨域请求，主要有以下几种方式可供选择：

*   返回新的CorsFilter
*   重写 WebMvcConfigurer
*   使用注解 `@CrossOrigin`
*   手动设置响应头 (HttpServletResponse)

**注意**:

*   CorFilter / WebMvConfigurer / @CrossOrigin 需要 SpringMVC 4.2以上版本才支持，对应于springBoot 1.3版本以上
*   上面前两种方式属于全局 CORS 配置，后两种属性局部 CORS配置。**如果使用了局部跨域是会覆盖全局跨域的规则，所以可以通过 `@CrossOrigin` 注解来进行细粒度更高的跨域资源控制**。

### 1.返回新的 CorsFilter(全局跨域)

在任意配置类，返回一个 新的 CorsFIlter Bean ，并添加映射路径和具体的CORS配置路径。  

```java
@Configuration
public class GlobalCorsConfig {
    @Bean
    public CorsFilter corsFilter() {
        //1. 添加 CORS配置信息
        CorsConfiguration config = new CorsConfiguration();
        //放行哪些原始域
        config.addAllowedOrigin("*");
        //是否发送 Cookie
        config.setAllowCredentials(true);
        //放行哪些请求方式
        config.addAllowedMethod("*");
        //放行哪些原始请求头部信息
        config.addAllowedHeader("*");
        //暴露哪些头部信息
        config.addExposedHeader("*");
        //2. 添加映射路径
        UrlBasedCorsConfigurationSource corsConfigurationSource = new UrlBasedCorsConfigurationSource();
        corsConfigurationSource.registerCorsConfiguration("/**",config);
        //3. 返回新的CorsFilter
        return new CorsFilter(corsConfigurationSource);
    }
}
```

### 2\. 重写 WebMvcConfigurer(全局跨域)

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                //是否发送Cookie
                .allowCredentials(true)
                //放行哪些原始域
                .allowedOrigins("*")
                .allowedMethods(new String[]{"GET", "POST", "PUT", "DELETE"})
                .allowedHeaders("*")
                .exposedHeaders("*");
    }
}
```

### 3\. 使用注解 (局部跨域)

在控制器上使用注解 **@CrossOrigin**:  

```java
@RestController
@CrossOrigin(origins = "*")
public class HelloController {
    @RequestMapping("/hello")
    public String hello() {
        return "hello world";
    }
}
```

在方法上使用注解 **@CrossOrigin**:  

```java
@RequestMapping("/hello")
    @CrossOrigin(origins = "*")
    public String hello() {
        return "hello world";
    }
```

### 4\. 手动设置响应头(局部跨域)

使用 HttpServletResponse 对象添加响应头(Access-Control-Allow-Origin)来授权原始域，这里 Origin的值也可以设置为 “\*”,表示全部放行。  

```java
@RequestMapping("/index")
public String index(HttpServletResponse response) {
    response.addHeader("Access-Allow-Control-Origin","*");
    return "index";
}
```

## 参考资料 & 鸣谢

*   [SpringBoot 实现前后端分离的跨域访问（CORS）](http://www.spring4all.com/article/177)
*   [跨域资源共享 CORS 详解](http://www.ruanyifeng.com/blog/2016/04/cors.html)
