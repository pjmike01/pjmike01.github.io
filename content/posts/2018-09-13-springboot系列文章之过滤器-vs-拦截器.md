---
title: "springboot系列文章之过滤器 vs 拦截器"
date: 2018-09-13
slug: "springboot系列文章之过滤器-vs-拦截器"
tags: ["springboot"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/c.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 过滤器](#过滤器)
    1.  [2.1. 自定义Filter过滤器](#自定义Filter过滤器)
    2.  [2.2. FilterRegistrationBean方式](#FilterRegistrationBean方式)
3.  [3. 拦截器](#拦截器)
    1.  [3.1. 自定义拦截器](#自定义拦截器)
    2.  [3.2. 注册拦截器同时配置拦截器规则](#注册拦截器同时配置拦截器规则)
    3.  [3.3. 多个拦截器协同工作](#多个拦截器协同工作)
4.  [4. 拦截器与过滤器之间的区别](#拦截器与过滤器之间的区别)
5.  [5. 小结](#小结)
6.  [6. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

之前实际开发项目的时候，虽然有用过滤器和拦截器，但是理解上还是有点懵懵懂懂的，没有彻底明白，这篇文章就来仔细剖析下这二者的区别与联系。

## 过滤器

过滤器Filter，是在Servlet规范中定义的，是Servlet容器支持的，该接口定义在 `javax.servlet`包下，主要是在客户端请求(HttpServletRequest)进行预处理，以及对服务器响应(HttpServletResponse)进行后处理。接口代码如下:

```java
package javax.servlet;

import java.io.IOException;

public interface Filter {
    void init(FilterConfig var1) throws ServletException;

    void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException;

    void destroy();
}
```

对上面三个接口方法进行分析:

*   **init(FilterConfig)**: 初始化接口，在用户自定义的Filter初始化时被调用，它与Servlet的 init方法的作用是一样的。
*   **doFilter(ServletRequest,ServletResponse,FilterChain)**: 在每个用户的请求进来时这个方法都会被调用，并在Servlet的service方法之前调用(如果我们是开发Servlet项目)，而FilterChain就代表当前的整个请求链，通过调用 `FilterChain.doFilter`可以将请求继续传递下去，如果想拦截这个请求，可以不调用FilterChain.doFilter，那么这个请求就直接返回了，**所以Filter是一种责任链设计模式**，在`spring security`就大量使用了过滤器，有一条过滤器链。
*   **destroy**: 当Filter对象被销毁时，这个方法被调用，注意，当Web容器调用这个方法之后，容器会再调用一次doFilter方法。

### 自定义Filter过滤器

在springboot自定义Filter类如下:  

```java
@Component
public class MyFilter implements Filter {
    private Logger logger = LoggerFactory.getLogger(MyFilter.class);
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        logger.info("filter init");
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        logger.info("doFilter");
        //对request,response进行预处理
        //TODO 进行业务逻辑
        filterChain.doFilter(servletRequest, servletResponse);
    }

    @Override
    public void destroy() {
        logger.info("filter destroy");
    }
}
```

### FilterRegistrationBean方式

在springboot中提供了`FilterRegistrationBean`方式，此类提供setOrder方法，可以为多个filter设置排序值。代码如下:  

```java
@Configuration
public class FilterConfig {
    /**
     * 配置一个Filter注册器
     *
     * @return
     */
    @Bean
    public FilterRegistrationBean filterRegistrationBean1() {
        FilterRegistrationBean registrationBean = new FilterRegistrationBean();
        registrationBean.setFilter(filter1());
        registrationBean.setName("filter1");
        //设置顺序
        registrationBean.setOrder(10);
        return registrationBean;
    }
    @Bean
    public FilterRegistrationBean filterRegistrationBean2() {
        FilterRegistrationBean registrationBean = new FilterRegistrationBean();
        registrationBean.setFilter(filter2());
        registrationBean.setName("filter2");
        //设置顺序
        registrationBean.setOrder(3);
        return registrationBean;
    }
    @Bean
    public Filter filter1() {
        return new MyFilter();
    }

    @Bean
    public Filter filter2() {
        return new MyFilter2();
    }
}
```

## 拦截器

拦截器是Spring提出的概念，它的作用于过滤器类似，可以拦截用户请求并进行相应的处理，它可以进行更加精细的控制。

在SpringMVC中，DispatcherServlet捕获每个请求，在到达对应的Controller之前，请求可以被拦截器处理，在拦截器中进行前置处理后，请求最终才到达Controller。

拦截器的接口是 `org.springframework.web.servlet.HandlerInterceptor`接口，接口代码如下:  

```java
public interface HandlerInterceptor {
    default boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        return true;
    }

    default void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, @Nullable ModelAndView modelAndView) throws Exception {
    }

    default void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, @Nullable Exception ex) throws Exception {
    }
}
```

接口方法解读:

*   **preHandle方法**：对客户端发过来的请求进行前置处理，如果方法返回true,继续执行后续操作，如果返回false，执行中断请求处理，请求不会发送到Controller
*   **postHandler方法**：在请求进行处理后执行，也就是在Controller方法调用之后处理，当然前提是之前的 `preHandle`方法返回 true。具体来说，`postHandler`方法会在DispatcherServlet进行视图返回渲染前被调用，也就是说我们可以在这个方法中对 Controller 处理之后的`ModelAndView`对象进行操作
*   **afterCompletion方法**: 该方法在整个请求结束之后执行，当然前提依然是 `preHandle`方法的返回值为 true才行。该方法一般用于资源清理工作

### 自定义拦截器

```java
public class MyInterceptor implements HandlerInterceptor {
    private Logger logger = LoggerFactory.getLogger(MyInterceptor.class);
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        logger.info("preHandle....");
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        logger.info("postHandle...");
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        logger.info("afterCompletion...");
    }
}
```

### 注册拦截器同时配置拦截器规则

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(handlerInterceptor())
                //配置拦截规则
                .addPathPatterns("/**");
    }
    @Bean
    public HandlerInterceptor handlerInterceptor() {
        return new MyInterceptor();
    }
}
```

### 多个拦截器协同工作

在springMVC中我们可以实现多个拦截器，并依次将他们注册进去，如下：  

```java
public void addInterceptors(InterceptorRegistry registry) {
     registry.addInterceptor(handlerInterceptor())
             .addPathPatterns("/**");
     registry.addInterceptor(handlerInterceptor2())
             .addPathPatterns("/**");
 }
```

拦截器的顺序也跟他们注册时的顺序有关，至少 `preHandle`方法是这样，下图表示了两个拦截器协同工作时的执行顺序：

_\[配图已丢失: c.png\]_

上图出自[慕课网](https://www.imooc.com/learn/498)

后台打印日志也输出了相同的执行顺序:  

```java
io-9999-exec-2] c.p.filter.interceptor.MyInterceptor     : preHandle....
2018-09-13 12:13:31.292  INFO 9736 --- [nio-9999-exec-2] c.p.filter.interceptor.MyInterceptor2    : preHandle2....
2018-09-13 12:13:31.388  INFO 9736 --- [nio-9999-exec-2] c.p.filter.controller.HelloController    : username:pjmike,password:123456
2018-09-13 12:13:31.418  INFO 9736 --- [nio-9999-exec-2] c.p.filter.interceptor.MyInterceptor2    : postHandle2...
2018-09-13 12:13:31.418  INFO 9736 --- [nio-9999-exec-2] c.p.filter.interceptor.MyInterceptor     : postHandle...
2018-09-13 12:13:31.418  INFO 9736 --- [nio-9999-exec-2] c.p.filter.interceptor.MyInterceptor2    : afterCompletion2...
2018-09-13 12:13:31.418  INFO 9736 --- [nio-9999-exec-2] c.p.filter.interceptor.MyInterceptor     : afterCompletion...
```

## 拦截器与过滤器之间的区别

从上面对拦截器与过滤器的描述来看，它俩是非常相似的，都能对客户端发来的请求进行处理，它们的区别如下：

*   **作用域不同**
    *   过滤器依赖于servlet容器，只能在 servlet容器，web环境下使用
    *   拦截器依赖于spring容器，可以在spring容器中调用，不管此时Spring处于什么环境
*   **细粒度的不同**
    *   过滤器的控制比较粗，只能在请求进来时进行处理，对请求和响应进行包装
    *   拦截器提供更精细的控制，可以在controller对请求处理之前或之后被调用，也可以在渲染视图呈现给用户之后调用
*   **中断链执行的难易程度不同**
    *   拦截器可以 `preHandle`方法内返回 false 进行中断
    *   过滤器就比较复杂，需要处理请求和响应对象来引发中断，需要额外的动作，比如将用户重定向到错误页面

## 小结

简单总结一下，拦截器相比过滤器有更细粒度的控制，依赖于Spring容器，可以在请求之前或之后启动，过滤器主要依赖于servlet，过滤器能做的，拦截器基本上都能做。

## 参考资料 & 鸣谢

*   [Spring5源码解析-Spring中的处理拦截器](https://muyinchen.github.io/2017/08/07/Spring5%E6%BA%90%E7%A0%81%E8%A7%A3%E6%9E%90-Spring%E4%B8%AD%E7%9A%84%E5%A4%84%E7%90%86%E6%8B%A6%E6%88%AA%E5%99%A8/)
*   [深入分析Java Web技术内幕（修订版）](https://book.douban.com/subject/25953851/)
