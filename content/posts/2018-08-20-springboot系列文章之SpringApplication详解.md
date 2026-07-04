---
title: "springboot系列文章之SpringApplication详解"
date: 2018-08-20
slug: "springboot系列文章之SpringApplication详解"
tags: ["springboot"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/web.png"
  - "http://osvtz719h.bkt.clouddn.com/webApplica.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/initilazier.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/2.png"
  - "http://osvtz719h.bkt.clouddn.com/1.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/a.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/startup2%20-%20%E5%89%AF%E6%9C%AC.jpg"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/args.png"
  - "http://osvtz719h.bkt.clouddn.com/Applicatio.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/ap.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. SpringApplication的初始化](#SpringApplication的初始化)
    1.  [2.1. 1\. 推断应用类型](#1-推断应用类型)
    2.  [2.2. 2\. 加载初始化构造器ApplicationContextInitializer](#2-加载初始化构造器ApplicationContextInitializer)
    3.  [2.3. 3\. 创建应用监听器](#3-创建应用监听器)
    4.  [2.4. 4\. 设置应用main()方法所在的类](#4-设置应用main-方法所在的类)
3.  [3. SpringApplication的run方法](#SpringApplication的run方法)
    1.  [3.1. 1\. Headless模式设置](#1-Headless模式设置)
    2.  [3.2. 2\. 加载SpringApplicationRunListeners监听器](#2-加载SpringApplicationRunListeners监听器)
    3.  [3.3. 3\. 封装ApplicationArguments对象](#3-封装ApplicationArguments对象)
    4.  [3.4. 4\. 配置环境模块](#4-配置环境模块)
    5.  [3.5. 5\. 根据环境信息配置要忽略的bean信息](#5-根据环境信息配置要忽略的bean信息)
    6.  [3.6. 6\. Banner配置SpringBoot彩蛋](#6-Banner配置SpringBoot彩蛋)
    7.  [3.7. 7\. 创建ApplicationContext应用上下文](#7-创建ApplicationContext应用上下文)
    8.  [3.8. 8\. 加载SpringBootExceptionReporter](#8-加载SpringBootExceptionReporter)
    9.  [3.9. 9\. ApplicationContext基本属性配置](#9-ApplicationContext基本属性配置)
        1.  [3.9.1. 1). applyInitializers(context);](#1-applyInitializers-context)
        2.  [3.9.2. 2). load(ApplicationContext context, Object\[\] sources)](#2-load-ApplicationContext-context-Object-sources)
    10.  [3.10. 10\. 更新应用上下文](#10-更新应用上下文)
    11.  [3.11. 11\. afterRefresh()](#11-afterRefresh)
    12.  [3.12. 12\. callRunner()](#12-callRunner)
4.  [4. SpringBoot启动流程总结](#SpringBoot启动流程总结)
5.  [5. 小结](#小结)
6.  [6. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

还是从SpringBoot的启动类说起，这篇文章主要分析启动类中的SpringApplication  

```
@SpringBootApplication
public class Application {


    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

可以看出main函数中重要的就是`SpringApplication.run()`,这可以分为两部分来探讨：

*   **SpringApplication的构造过程**
*   **SpringApplication的run()方法**

## SpringApplication的初始化

首先进入SpringApplication的构造函数，先是单个参数的构造方法，后进入两个参数的构造方法，ResourceLoader是Spring的资源加载器，这里没有自定义的ResourceLoader传入，所以为NULL，而primarySources参数就是我们传入的Application.class启动类  

```java
public SpringApplication(Class<?>... primarySources) {
		this(null, primarySources);
	}
public SpringApplication(ResourceLoader resourceLoader, Class<?>... primarySources) {
		this.resourceLoader = resourceLoader;
		Assert.notNull(primarySources, "PrimarySources must not be null");
		this.primarySources = new LinkedHashSet<>(Arrays.asList(primarySources));
		//1. 推断应用类型
		this.webApplicationType = deduceWebApplicationType();
		//2. initializer初始化模块,加载ApplicationContextInitializer
		setInitializers((Collection) getSpringFactoriesInstances(
				ApplicationContextInitializer.class));
		//3. 加载监听器
		setListeners((Collection) getSpringFactoriesInstances(ApplicationListener.class));
		//4. 配置应用main方法所在的类
		this.mainApplicationClass = deduceMainApplicationClass();
	}
```

SpringApplication的初始化主要包括以下4个步骤:

*   **推断应用类型**
*   **加载初始化构造器ApplicationContextInitializer**
*   **创建应用监听器**
*   **设置应用main()方法所在的类**

### 1\. 推断应用类型

**this.webEnvironment=deduceWebApplicationType();** 判断应用的类型，是否是servlet应用还是reactive应用或者是none，**webEnvironment中定义了这三种类型**  

_\[配图已丢失: web.png\]_

  

_\[配图已丢失: webApplica.png\]_

### 2\. 加载初始化构造器ApplicationContextInitializer

**setInitializers((Collection)getSpringFactoriesInstances(ApplicationContextInitializer.class))：** 通过SpringFactoriesLoader在应用的classpath中查找并加载所有可用的ApplicationContextInitializer  

_\[配图已丢失: initilazier.png\]_

  
进入loadFactoryNames方法,然后**进入loadSpringFactories方法，获取当前ClassLoader下的所有META-INF/spring.factories文件的配置信息**

而后通过**loadSpringFactories(classloader).getOrDefault(factoryClassName,Collections.emptyList())** 从所有META-INF/spring.factories文件的配置信息的map中获取指定的factory的值  

_\[配图已丢失: 2.png\]_

  

_\[配图已丢失: 1.png\]_

  
默认情况下，从 spring.factories 文件找出的 key 为 ApplicationContextInitializer 的类有如上图中所示4种

**对于 ApplicationContextInitializer，它是应用程序初始化器，做一些初始化工作**  

```java
public interface ApplicationContextInitializer<C extends ConfigurableApplicationContext> {

	/**
	 * Initialize the given application context.
	 * @param applicationContext the application to configure
	 */
	void initialize(C applicationContext);

}
```

### 3\. 创建应用监听器

setListeners()方法与setInitializers()方法类似，只不过它是使用SpringFactoriesLoader在应用的classpath的META-INT/spring.factories中查找并加载所有可用的ApplicationListener  

```java
setListeners((Collection) getSpringFactoriesInstances(ApplicationListener.class));
```

_\[配图已丢失: a.png\]_

  
ApplicationListener，应用程序事件(ApplicationEvent)监听器：

```
public interface ApplicationListener<E extends ApplicationEvent> extends EventListener {
	void onApplicationEvent(E event);
}
```

更详细的分析可以参阅我之前的文章: [springboot系列文章之启动时初始化数据](https://pjmike.github.io/2018/08/16/springboot%E7%B3%BB%E5%88%97%E6%96%87%E7%AB%A0%E4%B9%8B%E5%90%AF%E5%8A%A8%E6%97%B6%E5%88%9D%E5%A7%8B%E5%8C%96%E6%95%B0%E6%8D%AE/)

### 4\. 设置应用main()方法所在的类

在SpringApplication构造函数的最后一步，根据调用栈推断并设置main方法的定义类  

```
private Class<?> deduceMainApplicationClass() {
	try {
		StackTraceElement[] stackTrace = new RuntimeException().getStackTrace();
		for (StackTraceElement stackTraceElement : stackTrace) {
			if ("main".equals(stackTraceElement.getMethodName())) {
				return Class.forName(stackTraceElement.getClassName());
			}
		}
	}
	catch (ClassNotFoundException ex) {
		// Swallow and continue
	}
	return null;
}
```

## SpringApplication的run方法

SpringApplication实例初始化完成并且完成设置后，就可以开始run方法的逻辑了，对于这个run方法我将分为以下几点进行逐步剖析，而StopWatch是一个工具类，主要是方便记录程序运行时间，这里就不仔细介绍了。  

```java
public ConfigurableApplicationContext run(String... args) {
        //构造一个任务执行观察期
	StopWatch stopWatch = new
	StopWatch();
	//开始执行，记录开始时间
	stopWatch.start();
	ConfigurableApplicationContext context = null;
	Collection<SpringBootExceptionReporter> exceptionReporters = new ArrayList<>();
	//1
	configureHeadlessProperty();
	//2
	SpringApplicationRunListeners listeners = getRunListeners(args);
	listeners.starting();
	try {

	     //3
		ApplicationArguments applicationArguments = new DefaultApplicationArguments(
				args);
		//4
		ConfigurableEnvironment environment = prepareEnvironment(listeners,
				applicationArguments);
		//5
		configureIgnoreBeanInfo(environment);
		//6
		Banner printedBanner = printBanner(environment);
		//7
		context = createApplicationContext();
		//8
		exceptionReporters = getSpringFactoriesInstances(
				SpringBootExceptionReporter.class,
				new Class[] { ConfigurableApplicationContext.class }, context);
		//9
		prepareContext(context, environment, listeners, applicationArguments,
				printedBanner);
		//10
		refreshContext(context);
		//2.0版本中是空实现
		//11
		afterRefresh(context, applicationArguments);
		stopWatch.stop();
		if (this.logStartupInfo) {
			new StartupInfoLogger(this.mainApplicationClass)
					.logStarted(getApplicationLog(), stopWatch);
		}
		listeners.started(context);
		//12
		callRunners(context, applicationArguments);
	}
	catch (Throwable ex) {
		handleRunFailure(context, ex, exceptionReporters, listeners);
		throw new IllegalStateException(ex);
	}

	try {
		listeners.running(context);
	}
	catch (Throwable ex) {
		handleRunFailure(context, ex, exceptionReporters, null);
		throw new IllegalStateException(ex);
	}
	return context;
}
```

SpringApplication的run方法主要分为以下几步:

*   **Headless模式设置**
*   ****加载SpringApplicationRunListeners监听器****
*   **封装ApplicationArguments对象**
*   **配置环境模块**
*   **根据环境信息配置要忽略的bean信息**
*   **Banner配置SpringBoot彩蛋**
*   **创建ApplicationContext应用上下文**
*   **加载SpringBootExceptionReporter**
*   **ApplicationContext基本属性配置**
*   **更新应用上下文**
*   **查找是否注册有CommandLineRunner/ApplicationRunner**
    
    ### 1\. Headless模式设置
    
    `configureHeadlessProperty()`设置 headless 模式，即设置系统属性java.awt.headless，它是J2SE的一种模式，用于在缺少显示屏，键盘，或者鼠标时的系统配置，该属性会被设置为true,更多的信息可以参考[这里](http://www.oracle.com/technetwork/articles/javase/headless-136834.html)
    
    ```java
    private static final String SYSTEM_PROPERTY_JAVA_AWT_HEADLESS = "java.awt.headless";
        ...
    private void configureHeadlessProperty() {
    		System.setProperty(SYSTEM_PROPERTY_JAVA_AWT_HEADLESS, System.getProperty(
    				SYSTEM_PROPERTY_JAVA_AWT_HEADLESS, Boolean.toString(this.headless)));
    	}
    ```
    

### 2\. 加载SpringApplicationRunListeners监听器

```java
SpringApplicationRunListeners listeners = getRunListeners(args);
```

`getRunListeners(args)`也是通过 `SpringFactoriesLoader` 从`META-INF/spring.factories`查找到并加载的`SpringApplicationRunListener`。该类实际上是监听SpringApplication的run方法的执行  

```java
private SpringApplicationRunListeners getRunListeners(String[] args) {
	Class<?>[] types = new Class<?>[] { SpringApplication.class, String[].class };
	return new SpringApplicationRunListeners(logger, getSpringFactoriesInstances(
			SpringApplicationRunListener.class, types, this, args));
}

.....
private <T> Collection<T> getSpringFactoriesInstances(Class<T> type,
		Class<?>[] parameterTypes, Object... args) {
	ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
	// Use names and ensure unique to protect against duplicates
	//通过SpringFactoriesLoader可以查找到并加载的SpringApplicationRunListner
	Set<String> names = new LinkedHashSet<>(SpringFactoriesLoader.loadFactoryNames(type, classLoader));
	List<T> instances = createSpringFactoriesInstances(type, parameterTypes,
			classLoader, args, names);
	AnnotationAwareOrderComparator.sort(instances);
	return instances;
}
```

这里的SpringApplicationRunListener监听器与SpringApplication时加载的ApplicationListener监听器不同，SpringApplicationRunListener是SpringBoot新增的类，SpringApplicationRunListener目前只有一个实现类EventPublishingRunListener。虽然说是新增的， 但是它们之间是有联系的，它们之间的的关系是通过ApplicationEventMulticaster广播出去的SpringApplicationEvent所联系起来的  

_\[配图已丢失: startup2\_-\_副本.jpg\]_

更详细的分析请参阅 ：[SpringBoot源码分析之SpringBoot的启动过程](https://fangjian0423.github.io/2017/04/30/springboot-startup-analysis/)

### 3\. 封装ApplicationArguments对象

将args参数封装成 `ApplicationArguments` 对象  

```java
public DefaultApplicationArguments(String[] args) {
	Assert.notNull(args, "Args must not be null");
	this.source = new Source(args);
	this.args = args;
}
```

官网对 `ApplicationArguments` 的解释如下  

_\[配图已丢失: args.png\]_

### 4\. 配置环境模块

根据`listeners` 和`applicationArguments` 创建并配置当前SpringBoot应用将要使用的Enviroment  

```java
private ConfigurableEnvironment prepareEnvironment(
		SpringApplicationRunListeners listeners,
		ApplicationArguments applicationArguments) {
	// Create and configure the environment
	ConfigurableEnvironment environment = getOrCreateEnvironment();
	configureEnvironment(environment, applicationArguments.getSourceArgs());
	listeners.environmentPrepared(environment);
	bindToSpringApplication(environment);
	if (this.webApplicationType == WebApplicationType.NONE) {
		environment = new EnvironmentConverter(getClassLoader())
				.convertToStandardEnvironmentIfNecessary(environment);
	}
	ConfigurationPropertySources.attach(environment);
	return environment;
}
```

遍历调用所有SpringApplicationRunListener的`enviromentPrepared()`方法就是宣告当前SpringBoot应用使用的Enviroment准备好了

### 5\. 根据环境信息配置要忽略的bean信息

```java
private void configureIgnoreBeanInfo(ConfigurableEnvironment environment) {
	if (System.getProperty(
			CachedIntrospectionResults.IGNORE_BEANINFO_PROPERTY_NAME) == null) {
		Boolean ignore = environment.getProperty("spring.beaninfo.ignore",
				Boolean.class, Boolean.TRUE);
		System.setProperty(CachedIntrospectionResults.IGNORE_BEANINFO_PROPERTY_NAME,
				ignore.toString());
	}
}
```

### 6\. Banner配置SpringBoot彩蛋

打印banner标志，就是启动SpringBoot项目时出现的`Spring`字样，当然我们也可以自定义banner，这里就不多说了  

```
private Banner printBanner(ConfigurableEnvironment environment) {
		if (this.bannerMode == Banner.Mode.OFF) {
			return null;
		}
		ResourceLoader resourceLoader = (this.resourceLoader != null)
				? this.resourceLoader : new DefaultResourceLoader(getClassLoader());
		SpringApplicationBannerPrinter bannerPrinter = new SpringApplicationBannerPrinter(
				resourceLoader, this.banner);
		if (this.bannerMode == Mode.LOG) {
			return bannerPrinter.print(environment, this.mainApplicationClass, logger);
		}
		return bannerPrinter.print(environment, this.mainApplicationClass, System.out);
	}
```

### 7\. 创建ApplicationContext应用上下文

`createApplicationContext()`根据用户是否明确设置了applicationContextClass类型以及SpringApplication初始化阶段的推断结果，决定该为当前SpringBoot应用创建什么类型的ApplicationContext并创建完成。  

```java
public static final String DEFAULT_CONTEXT_CLASS = "org.springframework.context."
        + "annotation.AnnotationConfigApplicationContext";
public static final String DEFAULT_WEB_CONTEXT_CLASS = "org.springframework.boot."
        + "web.servlet.context.AnnotationConfigServletWebServerApplicationContext";
private static final String[] WEB_ENVIRONMENT_CLASSES = { "javax.servlet.Servlet",
        "org.springframework.web.context.ConfigurableWebApplicationContext" };	
        
        
protected ConfigurableApplicationContext createApplicationContext() {
    //用户是否明确设置了applicationContextClass,在SpringApplication中有对应的setter方法
    Class<?> contextClass = this.applicationContextClass;
        //如果没有主动设置
    if (contextClass == null) {
        try {
            //判断当前应用的类型，也就是之前SpringApplication初始化阶段的推断结果
            switch (this.webApplicationType) {
            //servlet应用程序
            case SERVLET: 
                contextClass = Class.forName(DEFAULT_WEB_CONTEXT_CLASS);
                break;
            //reactive响应式程序
            case REACTIVE:
                contextClass = Class.forName(DEFAULT_REACTIVE_WEB_CONTEXT_CLASS);
                break;
            //默认类型
            default:
                contextClass = Class.forName(DEFAULT_CONTEXT_CLASS);
            }
        }
        catch (ClassNotFoundException ex) {
            throw new IllegalStateException(
                    "Unable create a default ApplicationContext, "
                            + "please specify an ApplicationContextClass",
                    ex);
        }
    }
    return (ConfigurableApplicationContext) BeanUtils.instantiateClass(contextClass);
}
```

在SpringBoot官网对ApplicationContext的类型是如下定义的：  

_\[配图已丢失: Applicatio.png\]_

*   当SpringMVC存在的时候，就使用AnnotationConfigServletWebServerApplicationContext
*   当SpringMVC不存在的时候，Spring WebFlux响应式存在的时候，使用AnnotationConfigReactiveWebServerApplicationContext
*   如果以上都不是，默认就用AnnotationConfigApplicationContext
*   SpringApplication存在设置ApplicationContext的方法，在JUnit测试中使用SpringApplication通常要设置ApplicationContext

### 8\. 加载SpringBootExceptionReporter

```java
exceptionReporters = getSpringFactoriesInstances(
					SpringBootExceptionReporter.class,
					new Class[] { ConfigurableApplicationContext.class }, context);
```

```java
private <T> Collection<T> getSpringFactoriesInstances(Class<T> type,
		Class<?>[] parameterTypes, Object... args) {
	ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
	// Use names and ensure unique to protect against duplicates
	Set<String> names = new LinkedHashSet<>(
			SpringFactoriesLoader.loadFactoryNames(type, classLoader));
	List<T> instances = createSpringFactoriesInstances(type, parameterTypes,
			classLoader, args, names);
	AnnotationAwareOrderComparator.sort(instances);
	return instances;
}
```

这里也是通过SpringFactoriesLoader加载META-INF/spring.factories中key为SpringBootExceptionReporter的全类名的value值

*   `SpringBootExceptionReporter`是一个回调接口，用于支持对`SpringApplication`启动错误的自定义报告。里面就一个报告启动失败的方法
*   其实现类：`org.springframework.boot.diagnostics.FailureAnalyzers`  
    用于触发从spring.factories加载的`FailureAnalyzer`和`FailureAnalysisReporter`实例

### 9\. ApplicationContext基本属性配置

```java
private void prepareContext(ConfigurableApplicationContext context,
		ConfigurableEnvironment environment, SpringApplicationRunListeners listeners,
		ApplicationArguments applicationArguments, Banner printedBanner) {
	//设置应用的环境
	context.setEnvironment(environment);
	//对 context 进行了预设置
	postProcessApplicationContext(context);
	applyInitializers(context);
	遍历调用SpringApplicationRunListener的contextPrepared()方法,通告SpringBoot应用使用的ApplicationContext准备好了
	listeners.contextPrepared(context);
	if (this.logStartupInfo) {
		logStartupInfo(context.getParent() == null);
		logStartupProfileInfo(context);
	}

	// Add boot specific singleton beans
	context.getBeanFactory().registerSingleton("springApplicationArguments",
			applicationArguments);
	if (printedBanner != null) {
		context.getBeanFactory().registerSingleton("springBootBanner", printedBanner);
	}

	// Load the sources
	Set<Object> sources = getAllSources();
	Assert.notEmpty(sources, "Sources must not be empty");
	load(context, sources.toArray(new Object[0]));
	//遍历调用SpringApplicationRunListener的contextLoaded()方法，通告ApplicationContext装填完毕
	listeners.contextLoaded(context);
}
```

#### 1). applyInitializers(context);

```
protected void applyInitializers(ConfigurableApplicationContext context) {   
	for (ApplicationContextInitializer initializer : getInitializers()) {
		Class<?> requiredType = GenericTypeResolver.resolveTypeArgument(
				initializer.getClass(), ApplicationContextInitializer.class);
		Assert.isInstanceOf(requiredType, context, "Unable to call initializer.");
		initializer.initialize(context);
	}
}
```

遍历调用这些ApplicationContextInitializer的initialize(applicationContext)方法来对已经创建好的ApplicationContext进行进一步的处理

#### 2). load(ApplicationContext context, Object\[\] sources)

```
protected void load(ApplicationContext context, Object[] sources) {
		if (logger.isDebugEnabled()) {
			logger.debug(
					"Loading source " + StringUtils.arrayToCommaDelimitedString(sources));
		}
		BeanDefinitionLoader loader = createBeanDefinitionLoader(
				getBeanDefinitionRegistry(context), sources);
		if (this.beanNameGenerator != null) {
			loader.setBeanNameGenerator(this.beanNameGenerator);
		}
		if (this.resourceLoader != null) {
			loader.setResourceLoader(this.resourceLoader);
		}
		if (this.environment != null) {
			loader.setEnvironment(this.environment);
		}
		loader.load();
	}
```

设置资源加载器，加载各种beans到ApplicationContext对象中

### 10\. 更新应用上下文

```
private void refreshContext(ConfigurableApplicationContext context) {
	refresh(context);
	if (this.registerShutdownHook) {
		try {
			context.registerShutdownHook();
		}
		catch (AccessControlException ex) {
			// Not allowed in some environments.
		}
	}
}
```

进入内部的refresh()方法，准备环境所需的bean工厂，通过工厂产生环境所需的bean,重点就是产生bean  

```java
@Override
public void refresh() throws BeansException, IllegalStateException {
	synchronized (this.startupShutdownMonitor) {
		// Prepare this context for refreshing.
		prepareRefresh();

		// Tell the subclass to refresh the internal bean factory.
		ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

		// Prepare the bean factory for use in this context.
		prepareBeanFactory(beanFactory);

		try {
			// Allows post-processing of the bean factory in context subclasses.
			postProcessBeanFactory(beanFactory);

			// Invoke factory processors registered as beans in the context.
			invokeBeanFactoryPostProcessors(beanFactory);

			// Register bean processors that intercept bean creation.
			registerBeanPostProcessors(beanFactory);

			// Initialize message source for this context.
			initMessageSource();

			// Initialize event multicaster for this context.
			initApplicationEventMulticaster();

			// Initialize other special beans in specific context subclasses.
			onRefresh();

			// Check for listener beans and register them.
			registerListeners();

			// Instantiate all remaining (non-lazy-init) singletons.
			finishBeanFactoryInitialization(beanFactory);

			// Last step: publish corresponding event.
			finishRefresh();
		}
```

### 11\. afterRefresh()

上下文刷新后调用该方法，目前没有操作  

```java
protected void afterRefresh(ConfigurableApplicationContext context,
		ApplicationArguments args) {
}
```

### 12\. callRunner()

```java
private void callRunners(ApplicationContext context, ApplicationArguments args) {
	List<Object> runners = new ArrayList<>();
	runners.addAll(context.getBeansOfType(ApplicationRunner.class).values());
	runners.addAll(context.getBeansOfType(CommandLineRunner.class).values());
	AnnotationAwareOrderComparator.sort(runners);
	for (Object runner : new LinkedHashSet<>(runners)) {
		if (runner instanceof ApplicationRunner) {
			callRunner((ApplicationRunner) runner, args);
		}
		if (runner instanceof CommandLineRunner) {
			callRunner((CommandLineRunner) runner, args);
		}
	}
}
```

查找当前的ApplicationContext中是否注册有CommandLineRunner或者ApplicationRunner,如果有，就遍历执行他们。

## SpringBoot启动流程总结

上面从SpringApplication的初始化到SpringApplication.run()方法执行，基本上按照其内部函数调用的顺序一步一步分析下来，内容非常多，很容易把人搞晕。在网上发现一张图，图出自[SpringBoot启动流程解析](https://www.cnblogs.com/trgl/p/7353782.html)，画的比较清楚明白，把SpringBoot启动整个流程都包含进来了  

_\[配图已丢失: ap.png\]_

  
再总结下run方法中最关键的几步:

*   **加载SpringApplicationRunListeners监听器**
*   **配置环境模块**
*   **创建ApplicationContext应用上下文**
*   **ApplicationContext基本属性配置**
*   **更新应用上下文,产生环境所需要的bean**
    
    ## 小结
    
    上面的分析都是基于SpringBoot2.0版本，在之前的版本，内容上可能有些偏差，大体思路是差不多的。在阅读源码的过程中，看了很多前人分析的博客文章，也借鉴了他们的分析流程，有点「前人栽树，后人乘凉」的感觉，现在「取之网络，再回馈之网络」

## 参考资料 & 鸣谢

*   [SpringBoot启动流程解析](https://www.cnblogs.com/trgl/p/7353782.html)
*   [SpringBoot源码分析之SpringBoot的启动过程](https://fangjian0423.github.io/2017/04/30/springboot-startup-analysis/)
*   [Spring Boot 2.0系列文章(七)：SpringApplication 深入探索](http://www.54tianzhisheng.cn/2018/04/30/springboot_SpringApplication/)
