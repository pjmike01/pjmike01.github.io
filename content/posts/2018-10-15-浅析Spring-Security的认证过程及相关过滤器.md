---
title: "浅析Spring Security的认证过程及相关过滤器"
date: 2018-10-15
slug: "浅析Spring-Security的认证过程及相关过滤器"
tags: ["Spring Security"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/spring-security-filter-chain.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/filter_processs.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/filtersecurityInterceptor.png"
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. 核心过滤器链简介](#核心过滤器链简介)
3.  [3. 表单登录认证过程](#表单登录认证过程)
    1.  [3.1. SecurityContextPersistenceFilter](#SecurityContextPersistenceFilter)
    2.  [3.2. UsernamePasswordAuthenticationFilter](#UsernamePasswordAuthenticationFilter)
    3.  [3.3. AnonymousAuthenticationFilter](#AnonymousAuthenticationFilter)
    4.  [3.4. ExceptionTranslationFilter](#ExceptionTranslationFilter)
    5.  [3.5. FilterSecurityInterceptor](#FilterSecurityInterceptor)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

上一篇文章[浅析Spring Security 核心组件](https://pjmike.github.io/2018/10/12/%E6%B5%85%E6%9E%90Spring-Security-%E6%A0%B8%E5%BF%83%E7%BB%84%E4%BB%B6/)中介绍了Spring Security的基本组件，有了前面的基础，这篇文章就来详细分析下Spring Security的认证过程。

**Spring Security 的核心之一就是它的过滤器链，我们就从它的过滤器链入手，下图是Spring Security 过滤器链的一个执行过程，本文将依照该过程来逐步的剖析其认证过程**。

_\[配图已丢失: spring-security-filter-chain.png\]_

## 核心过滤器链简介

Spring Security 中的过滤器有很多，一般正常的项目中都有十几个过滤器，有时候还包含自定义的过滤器，当然我们不可能对每一个过滤器都进行分析，我们需要抓住重点，找比较关键的几个过滤器，它们在认证过程中扮演着重要角色，下面列举几个核心的过滤器：

*   **SecurityContextPersistenceFilter**： 整个Spring Security 过滤器链的开端，它有两个作用：一是当请求到来时，检查`Session`中是否存在`SecurityContext`,如果不存在，就创建一个新的`SecurityContext`。二是请求结束时将`SecurityContext`放入 `Session`中，并清空 `SecurityContextHolder`。
*   **UsernamePasswordAuthenticationFilter**： 继承自抽象类 `AbstractAuthenticationProcessingFilter`，当进行表单登录时，该Filter将用户名和密码封装成一个 `UsernamePasswordAuthentication`进行验证。
*   **AnonymousAuthenticationFilter**: 匿名身份过滤器，当前面的Filter认证后依然没有用户信息时，该Filter会生成一个匿名身份——`AnonymousAuthenticationToken`。一般的作用是用于匿名登录。
*   **ExceptionTranslationFilter**： 异常转换过滤器，用于处理 `FilterSecurityInterceptor`抛出的异常。
*   **FilterSecurityInterceptor**： 过滤器链最后的关卡，从 SecurityContextHolder中获取 Authentication，比对用户拥有的权限和所访问资源需要的权限。

## 表单登录认证过程

当我们访问一个受保护的资源时，如果之前没有进行登录认证，那么系统将返回一个登录表单或者一个响应结果提示我们要先进行登录操作。我们这里的分析过程只针对表单登录，所以我们先在表单中填写用户名和密码进行登录验证。

上面已经简述了一堆核心过滤器，这里先从 `SecurityContextPersistenceFilter`这个过滤器的开端开始分析整个表单登录的认证过程。

### SecurityContextPersistenceFilter

当我们填写表单完毕后，点击登录按钮，请求先经过 `SecurityContextPersistenceFilter` 过滤器，在前面就曾提到，该Filter有两个作用，其中之一就是在请求到来时，创建 `SecurityContext`安全上下文，我们来看看它内部是如何做的，部分源码如下：  

```java
public class SecurityContextPersistenceFilter extends GenericFilterBean {

	static final String FILTER_APPLIED = "__spring_security_scpf_applied";
    //安全上下文存储的仓库
	private SecurityContextRepository repo;

	private boolean forceEagerSessionCreation = false;

	public SecurityContextPersistenceFilter() {
	    //使用HttpSession来存储 SecurityContext
		this(new HttpSessionSecurityContextRepository());
	}

	public SecurityContextPersistenceFilter(SecurityContextRepository repo) {
		this.repo = repo;
	}

	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;
        // 如果是第一次请求，request中肯定没有 FILTER_APPLIED属性
		if (request.getAttribute(FILTER_APPLIED) != null) {
			// 确保每个请求只应用一次过滤器
			chain.doFilter(request, response);
			return;
		}

		final boolean debug = logger.isDebugEnabled();
        // 在request 设置 FILTER_APPLIED 属性为 true，这样同一个请求再次访问时，就直接进入后续Filter的操作
		request.setAttribute(FILTER_APPLIED, Boolean.TRUE);
        
		if (forceEagerSessionCreation) {
			HttpSession session = request.getSession();

			if (debug && session.isNew()) {
				logger.debug("Eagerly created session: " + session.getId());
			}
		}
        // 封装 requset 和 response 
		HttpRequestResponseHolder holder = new HttpRequestResponseHolder(request,
				response);
		// 从存储安全上下文的仓库中载入 SecurityContext 安全上下文，其内部是从 Session中获取上下文信息
		SecurityContext contextBeforeChainExecution = repo.loadContext(holder);

		try {
		    //安全上下文信息设置到 SecurityContextHolder 中，以便在同一个线程中，后续访问 SecurityContextHolder 能获取到 SecuritContext
			SecurityContextHolder.setContext(contextBeforeChainExecution);
            //进入下一个过滤器操作
			chain.doFilter(holder.getRequest(), holder.getResponse());

		}
		finally {
		    // 请求结束后，清空安全上下文信息
			SecurityContext contextAfterChainExecution = SecurityContextHolder
					.getContext();
			// Crucial removal of SecurityContextHolder contents - do this before anything
			// else.
			SecurityContextHolder.clearContext();
			//将安全上下文信息存储到 Session中，相当于登录态的维护
			repo.saveContext(contextAfterChainExecution, holder.getRequest(),
					holder.getResponse());
			request.removeAttribute(FILTER_APPLIED);

			if (debug) {
				logger.debug("SecurityContextHolder now cleared, as request processing completed");
			}
		}
	}

	public void setForceEagerSessionCreation(boolean forceEagerSessionCreation) {
		this.forceEagerSessionCreation = forceEagerSessionCreation;
	}
}
```

请求到来时，利用`HttpSessionSecurityContextRepository`读取安全上下文。我们这里是第一次请求，读取的安全上下文中是没有 `Authentication`身份信息的，将安全上下文设置到 `SecurityContextHolder`之后，进入下一个过滤器。

请求结束时，同样利用`HttpSessionSecurityContextRepository`该存储安全上下文的仓库将认证后的`SecurityContext`放入 `Session`中，这也是**登录态维护**的关键，具体的操作这里就不细说了。

### UsernamePasswordAuthenticationFilter

经过 `SecurityContextPersistenceFilter`过滤器后来到 `UsernamePasswordAuthenticationFilter`过滤器，因为我们假定的是第一次请求，所以 `SecurityContext`并没有包含认证过的 `Authentication`。**从此过滤器开始的操作对于表单登录来说是非常关键的，包含了表单登录的核心认证步骤**，下面画了一张在此过滤器中的认证过程图：

_\[配图已丢失: filter\_processs.png\]_

`UsernamePasswordAuthenticationFilter` 的父类是 `AbstractAuthenticationProcessingFilter`,首先进入父类的 `foFilter`方法，部分源码如下：  

```
public abstract class AbstractAuthenticationProcessingFilter extends GenericFilterBean
		implements ApplicationEventPublisherAware, MessageSourceAware {
	...
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;
        ...
		Authentication authResult;

		try {
		    //调用子类 UsernamePasswordAuthenticationFilter 的 attemptAuthentication 方法
			authResult = attemptAuthentication(request, response);
			if (authResult == null) {
				// return immediately as subclass has indicated that it hasn't completed
				// authentication
				//子类未完成认证，立刻返回
				return;
			}
			sessionStrategy.onAuthentication(authResult, request, response);
		}
		catch (InternalAuthenticationServiceException failed) {
			logger.error(
					"An internal error occurred while trying to authenticate the user.",
					failed);
			unsuccessfulAuthentication(request, response, failed);

			return;
		}
		catch (AuthenticationException failed) {
			//认证失败
			unsuccessfulAuthentication(request, response, failed);

			return;
		}

		// 认证成功
		if (continueChainBeforeSuccessfulAuthentication) {
		    //继续调用下一个 Filter
			chain.doFilter(request, response);
		}
        //将成功认证后的Authentication写入 SecurityContext中
		successfulAuthentication(request, response, chain, authResult);
	}		
}
```

该`doFilter`方法中一个核心就是调用子类 `UsernamePasswordAuthenticationFilter`的`attemptAuthentication`方法，该方法进入真正的认证过程，并返回认证后的 `Authentication`,该方法的源码如下：  

```java
public Authentication attemptAuthentication(HttpServletRequest request,
			HttpServletResponse response) throws AuthenticationException {
		//必须是POST请求
		if (postOnly && !request.getMethod().equals("POST")) {
			throw new AuthenticationServiceException(
					"Authentication method not supported: " + request.getMethod());
		}
        //获取表单中的用户名和密码
		String username = obtainUsername(request);
		String password = obtainPassword(request);

		if (username == null) {
			username = "";
		}

		if (password == null) {
			password = "";
		}

		username = username.trim();
        //将用户名和密码封装成一个 UsernamePasswordAuthenticationToken
		UsernamePasswordAuthenticationToken authRequest = new UsernamePasswordAuthenticationToken(
				username, password);

		// Allow subclasses to set the "details" property
		setDetails(request, authRequest);
        //核心部分，交给内部的AuthenticationManager去认证，并返回认证后的 Authentication
		return this.getAuthenticationManager().authenticate(authRequest);
	}
```

该方法中有一个关键点就是 `his.getAuthenticationManager().authenticate(authRequest)`,调用内部的 `AuthenticationManager`去认证，在之前的[文章](https://pjmike.github.io/2018/10/12/%E6%B5%85%E6%9E%90Spring-Security-%E6%A0%B8%E5%BF%83%E7%BB%84%E4%BB%B6/#AuthenticationManager%E3%80%81ProviderManager-%E5%92%8C-AuthenticationProvider)就介绍过**AuthenticationManager，它是身份认证的核心接口，它的实现类是 `ProviderManager`,而 `ProviderManager`又将请求委托给一个 `AuthenticationProvider`列表，列表中的每一个 AuthenticationProvider将会被依次查询是否需要通过其进行验证,每个 provider的验证结果只有两个情况：抛出一个异常或者完全填充一个 Authentication对象的所有属性**

下面来分析一个关键的 `AuthenticationProvider`,它就是 `DaoAuthenticationProvider`，它是框架最早的provider,也是最最常用的 provider。大多数情况下我们会依靠它来进行身份认证，它的父类是 `AbstractUserDetailsAuthenticationProvider` ，认证过程首先会调用父类的 `authenticate`方法，核心源码如下：  

```java
public Authentication authenticate(Authentication authentication)
		throws AuthenticationException {
	Assert.isInstanceOf(UsernamePasswordAuthenticationToken.class, authentication,
			messages.getMessage(
					"AbstractUserDetailsAuthenticationProvider.onlySupports",
					"Only UsernamePasswordAuthenticationToken is supported"));

	// Determine username
	String username = (authentication.getPrincipal() == null) ? "NONE_PROVIDED"
			: authentication.getName();

	boolean cacheWasUsed = true;
	UserDetails user = this.userCache.getUserFromCache(username);

	if (user == null) {
		cacheWasUsed = false;

		try {
		    1 //调用子类  DaoAuthenticationProvider 的 retrieveUser()方法获取 UserDetails
			user = retrieveUser(username,
					(UsernamePasswordAuthenticationToken) authentication);
		}
		//没拿到UserDetails会抛出异常信息
		catch (UsernameNotFoundException notFound) {
			logger.debug("User '" + username + "' not found");

			if (hideUserNotFoundExceptions) {
				throw new BadCredentialsException(messages.getMessage(
						"AbstractUserDetailsAuthenticationProvider.badCredentials",
						"Bad credentials"));
			}
			else {
				throw notFound;
			}
		}

		Assert.notNull(user,
				"retrieveUser returned null - a violation of the interface contract");
	}

	try {
	    2 //对UserDetails的一些属性进行预检查，即判断用户是否锁定，是否可用以及用户是否过期
		preAuthenticationChecks.check(user);
		3 //对UserDetails附加的检查，对传入的Authentication与从数据库中获取的UserDetails进行密码匹配
		additionalAuthenticationChecks(user,
				(UsernamePasswordAuthenticationToken) authentication);
	}
	catch (AuthenticationException exception) {
		if (cacheWasUsed) {
			// There was a problem, so try again after checking
			// we're using latest data (i.e. not from the cache)
			cacheWasUsed = false;
			user = retrieveUser(username,
					(UsernamePasswordAuthenticationToken) authentication);
			preAuthenticationChecks.check(user);
			additionalAuthenticationChecks(user,
					(UsernamePasswordAuthenticationToken) authentication);
		}
		else {
			throw exception;
		}
	}
       4 //对UserDetails进行后检查，检查UserDetails的密码是否过期
	postAuthenticationChecks.check(user);

	if (!cacheWasUsed) {
		this.userCache.putUserInCache(user);
	}

	Object principalToReturn = user;

	if (forcePrincipalAsString) {
		principalToReturn = user.getUsername();
	}
       5 //上面所有检查成功后，用传入的用户信息和获取的UserDetails生成一个成功验证的Authentication
	return createSuccessAuthentication(principalToReturn, authentication, user);
}
```

从上面一大串源码中，提取几个关键的方法：

*   **retrieveUser(…)**: 调用子类 DaoAuthenticationProvider 的 retrieveUser()方法获取 UserDetails
*   **preAuthenticationChecks.check(user)**： 对从上面获取的UserDetails进行预检查，即判断用户是否锁定，是否可用以及用户是否过期
*   **additionalAuthenticationChecks(user,authentication)**: 对UserDetails附加的检查，对传入的Authentication与获取的UserDetails进行密码匹配
*   **postAuthenticationChecks.check(user)**: 对UserDetails进行后检查，即检查UserDetails的密码是否过期
*   **createSuccessAuthentication(principalToReturn, authentication, user)**： 上面所有检查成功后，利用传入的Authentication 和获取的UserDetails生成一个成功验证的Authentication

**retrieveUser(…)方法**

接下来详细说说 `retrieveUser(...)`方法， DaoAuthenticationProvider 的 retrieveUser() 源码如下：  

```java
protected final UserDetails retrieveUser(String username,
		UsernamePasswordAuthenticationToken authentication)
		throws AuthenticationException {
	prepareTimingAttackProtection();
	try {
	    //经过UserDetailsService 获取 UserDetails
		UserDetails loadedUser = this.getUserDetailsService().loadUserByUsername(username);
		if (loadedUser == null) {
			throw new InternalAuthenticationServiceException(
					"UserDetailsService returned null, which is an interface contract violation");
		}
		return loadedUser;
	}
	catch (UsernameNotFoundException ex) {
		mitigateAgainstTimingAttack(authentication);
		throw ex;
	}
	catch (InternalAuthenticationServiceException ex) {
		throw ex;
	}
	catch (Exception ex) {
		throw new InternalAuthenticationServiceException(ex.getMessage(), ex);
	}
}
```

该方法最核心的部分就是调用内部的UserDetailsServices 加载 UserDetails，`UserDetailsServices`本质上就是加载UserDetails的接口，UserDetails包含了比Authentication更加详细的用户信息。**UserDetailsService常见的实现类有JdbcDaoImpl，InMemoryUserDetailsManager，前者从数据库加载用户，后者从内存中加载用户。我们也可以自己实现UserDetailsServices接口，比如我们是如果是基于数据库进行身份认证，那么我们可以手动实现该接口，而不用JdbcDaoImpl。**

**additionalAuthenticationChecks()**

UserDetails的预检查和后检查比较简单，这里就不细说了，下面来看一下密码匹配校验，代码如下：  

```java
protected void additionalAuthenticationChecks(UserDetails userDetails,
			UsernamePasswordAuthenticationToken authentication)
			throws AuthenticationException {
		if (authentication.getCredentials() == null) {
			logger.debug("Authentication failed: no credentials provided");

			throw new BadCredentialsException(messages.getMessage(
					"AbstractUserDetailsAuthenticationProvider.badCredentials",
					"Bad credentials"));
		}

		String presentedPassword = authentication.getCredentials().toString();
        //利用 PasswordEncoder编码器校验密码
		if (!passwordEncoder.matches(presentedPassword, userDetails.getPassword())) {
			logger.debug("Authentication failed: password does not match stored value");

			throw new BadCredentialsException(messages.getMessage(
					"AbstractUserDetailsAuthenticationProvider.badCredentials",
					"Bad credentials"));
		}
	}
```

这个方法实际上是调用`DaoAuthenticationProvider`的`additionalAuthenticationChecks`方法，内部调用加密解密器进行密码匹配，如果匹配失败，则抛出一个 `BadCredentialsException`异常

最后通过`createSuccessAuthentication(..)`方法生成一个成功认证的 Authentication，简单说就是组合获取的UserDetails和传入的Authentication，得到一个完全填充的Authentication。

该Authentication最终一步一步向上返回，到`AbstractAuthenticationProcessingFilter`过滤器中，将其设置到 `SecurityContextHolder`。

### AnonymousAuthenticationFilter

匿名认证过滤器，它主要是针对匿名登录，如果前面的Filter，比如`UsernamePasswordAuthenticationFilter`执行完毕后，SecurityContext依旧没有用户信息，那么`AnonymousAuthenticationFilter`才会起作用，生成一个匿名身份信息——AnonymousAuthenticationToken

### ExceptionTranslationFilter

`ExceptionTranslationFilter` 简单的说就是处理 FilterSecurityInterceptor 抛出的异常，其内部 `doFilter`方法源码如下：  

```java
public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
		throws IOException, ServletException {
	HttpServletRequest request = (HttpServletRequest) req;
	HttpServletResponse response = (HttpServletResponse) res;

	try {
	    //直接进入下一个Filter
		chain.doFilter(request, response);

		logger.debug("Chain processed normally");
	}
	catch (IOException ex) {
		throw ex;
	}
	//真正的作用在这里，处理抛出的异常
	catch (Exception ex) {
		// Try to extract a SpringSecurityException from the stacktrace
		Throwable[] causeChain = throwableAnalyzer.determineCauseChain(ex);
		RuntimeException ase = (AuthenticationException) throwableAnalyzer
				.getFirstThrowableOfType(AuthenticationException.class, causeChain);
           //这里会处理 FilterSecurityInterceptor 抛出的AccessDeniedException
		if (ase == null) {
			ase = (AccessDeniedException) throwableAnalyzer.getFirstThrowableOfType(
					AccessDeniedException.class, causeChain);
		}

		if (ase != null) {
			if (response.isCommitted()) {
				throw new ServletException("Unable to handle the Spring Security Exception because the response is already committed.", ex);
			}
			handleSpringSecurityException(request, response, chain, ase);
		}
		else {
			// Rethrow ServletExceptions and RuntimeExceptions as-is
			if (ex instanceof ServletException) {
				throw (ServletException) ex;
			}
			else if (ex instanceof RuntimeException) {
				throw (RuntimeException) ex;
			}

			// Wrap other Exceptions. This shouldn't actually happen
			// as we've already covered all the possibilities for doFilter
			throw new RuntimeException(ex);
		}
	}
}
```

### FilterSecurityInterceptor

`FilterSecurityInterceptor` 过滤器是最后的关卡，之前的请求最终会来到这里，它的大致工作流程就是

*   封装请求信息
*   从系统中读取配信息，即资源所需的权限信息
*   从 `SecurityContextHolder`中获取之前认证过的 `Authentication`对象，即表示当前用户所拥有的权限
*   然后根据上面获取到的三种信息，传入一个权限校验器中，对于当前请求来说，比对用户拥有的权限和资源所需的权限。若比对成功，则进入真正系统的请求处理逻辑，反之，会抛出相应的异常

下面画一张简易的流程图来阐述 `FilterSecurityInterceptor`的执行过程,如下：

_\[配图已丢失: filtersecurityInterceptor.png\]_

根据上图内容，我们再来看看 `FilterSecurityInterceptor`的源码,  

```
public class FilterSecurityInterceptor extends AbstractSecurityInterceptor implements
		Filter {
	 ...
	public void doFilter(ServletRequest request, ServletResponse response,
		FilterChain chain) throws IOException, ServletException {
	// 封装request、response请求
	FilterInvocation fi = new FilterInvocation(request, response, chain);
	//调用核心方法
	invoke(fi);
	}	
	...
	public void invoke(FilterInvocation fi) throws IOException, ServletException {
	if ((fi.getRequest() != null)
			&& (fi.getRequest().getAttribute(FILTER_APPLIED) != null)
			&& observeOncePerRequest) {
		// filter already applied to this request and user wants us to observe
		// once-per-request handling, so don't re-do security checking
		fi.getChain().doFilter(fi.getRequest(), fi.getResponse());
	}
	else {
		// 判断当前请求之前是否经历过该过滤器
		if (fi.getRequest() != null && observeOncePerRequest) {
		//  如果当前请求已经经历过这个安全过滤器判断，那么不再执行后续逻辑，直接往下走，调用请求的处理方法
			fi.getRequest().setAttribute(FILTER_APPLIED, Boolean.TRUE);
		}
                //调用父类的方法，执行授权判断逻辑
		InterceptorStatusToken token = super.beforeInvocation(fi);
         
		try {
			fi.getChain().doFilter(fi.getRequest(), fi.getResponse());
		}
		finally {
			super.finallyInvocation(token);
		}

		super.afterInvocation(token, null);
	}
}

}
```

源码中已经对请求进行了封装，然后进入核心部分， 调用父类的授权判断方法——`beforeInvocation(FilterInvocation)`，源码如下：  

```java
protected InterceptorStatusToken beforeInvocation(Object object) {
		Assert.notNull(object, "Object was null");
		final boolean debug = logger.isDebugEnabled();

		if (!getSecureObjectClass().isAssignableFrom(object.getClass())) {
			throw new IllegalArgumentException(
					"Security invocation attempted for object "
							+ object.getClass().getName()
							+ " but AbstractSecurityInterceptor only configured to support secure objects of type: "
							+ getSecureObjectClass());
		}
		//读取Spring Security的配置信息，将其封装成 ConfigAttribute
		Collection<ConfigAttribute> attributes = this.obtainSecurityMetadataSource()
				.getAttributes(object);
		if (attributes == null || attributes.isEmpty()) {
			if (rejectPublicInvocations) {
				throw new IllegalArgumentException(
						"Secure object invocation "
								+ object
								+ " was denied as public invocations are not allowed via this interceptor. "
								+ "This indicates a configuration error because the "
								+ "rejectPublicInvocations property is set to 'true'");
			}
                            ...
			return null; // no further work post-invocation
		}
                ...
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			credentialsNotFound(messages.getMessage(
					"AbstractSecurityInterceptor.authenticationNotFound",
					"An Authentication object was not found in the SecurityContext"),
					object, attributes);
		}
		//从SecurityContextHolder中获取Authentication
		Authentication authenticated = authenticateIfRequired();

		// 启动授权匹配
		try {
			this.accessDecisionManager.decide(authenticated, object, attributes);
		}
		catch (AccessDeniedException accessDeniedException) {
			publishEvent(new AuthorizationFailureEvent(object, attributes, authenticated,
					accessDeniedException));

			throw accessDeniedException;
		}
                ...
	    
	}
```

`beforeInvocation`的源码比较多，我这里只保留了相对核心的部分，从源码就可以看出，拿到配置信息和用户信息后，连同请求信息一同传入`AccessDecisionManager`的 `decide(Authentication authentication, Object object,Collection<ConfigAttribute> configAttributes)`方法。该方法是最终执行授权校验逻辑的地方。

AccessDecisionManager 本身是一个接口，它的 实现类是 `AbstractAccessDecisionManager`,而 `AbstractAccessDecisionManager`也是一个抽象类，它的实现类有三个，常用的是 `AffirmativeBased`，最终的授权校验逻辑是 AffirmativeBased 实现的，部分源码如下：  

```java
public void decide(Authentication authentication, Object object,
		Collection<ConfigAttribute> configAttributes) throws AccessDeniedException {
	int deny = 0;
    //投票器执行投票
	for (AccessDecisionVoter voter : getDecisionVoters()) {
		int result = voter.vote(authentication, object, configAttributes);
                ...
		switch (result) {
		case AccessDecisionVoter.ACCESS_GRANTED:
			return;

		case AccessDecisionVoter.ACCESS_DENIED:
			deny++;

			break;

		default:
			break;
		}
	}

	if (deny > 0) {
		throw new AccessDeniedException(messages.getMessage(
				"AbstractAccessDecisionManager.accessDenied", "Access is denied"));
	}
        ...
}
```

该方法的逻辑比较简单，就是执行`AccessDecisionVoter`的校验逻辑，如果校验失败就抛出`AccessDeniedException`异常。对于AccessDecisionVoter的`vote`投票逻辑这里就不细说了，在 Spring Security 3.0以后，一般默认使用 `AccessDecisionVoter`接口的实现类**WebExpressionVoter**来完成最终的校验过程。

## 小结

上面从过滤器出发，对 Spring Security的认证过程做了一个还算详细的分析，当然还存在很多细节问题没有涉及到。

## 参考资料 & 鸣谢

*   [Spring Security(四)–核心过滤器源码分析](https://www.cnkirito.moe/spring-security-4/)
*   [SPRING SECURITY 4官方文档中文翻译与源码解读](http://www.tianshouzhi.com/api/tutorials/spring_security_4/278)
*   [Spring Security](https://docs.spring.io/spring-security/site/docs/5.1.0.RELEASE/reference/htmlsingle/)
