---
title: "浅析Spring Security 核心组件"
date: 2018-10-12
slug: "浅析Spring-Security-核心组件"
tags: ["Spring Security"]
---
**Catalogue**

1.  [1. 前言](#前言)
2.  [2. Spring Security的核心类](#Spring-Security的核心类)
    1.  [2.1. SecurityContextHolder、Securityontext和Authentication](#SecurityContextHolder、Securityontext和Authentication)
    2.  [2.2. AuthenticationManager、ProviderManager 和 AuthenticationProvider](#AuthenticationManager、ProviderManager-和-AuthenticationProvider)
        1.  [2.2.1. 认证成功后清除验证信息](#认证成功后清除验证信息)
    3.  [2.3. UserDetailsService 和 UserDetails](#UserDetailsService-和-UserDetails)
3.  [3. 认证过程样本示例](#认证过程样本示例)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## 前言

近几天在网上找了一个 Spring Security 和JWT 的例子来学习，项目地址是: [https://github.com/szerhusenBC/jwt-spring-security-demo](https://github.com/szerhusenBC/jwt-spring-security-demo) 作为学习Spring Security还是不错的，通过研究该 demo 发现自己对 `Spring Security`一知半解，并没有弄清楚Spring Seurity的流程，所以才想写一篇文章先来分析分析Spring Security的核心组件，其中参考了官方文档及其一些大佬写的Spring Security分析文章，有雷同的地方还请见谅。

## Spring Security的核心类

Spring Security的核心类主要包括以下几个：

*   **SecurityContextHolder**: 存放身份信息的容器
*   **Authentication**: 身份信息的抽象接口
*   **AuthenticationManager**: 身份认证器，认证的核心接口
*   **UserDetailsService**： 一般用于从数据库中加载身份信息
*   **UserDetails**: 相比Authentication，有更详细的身份信息

### SecurityContextHolder、Securityontext和Authentication

`SecurityContextHolder`用于存储安全上下文(security context)的信息，即一个存储身份信息，认证信息等的容器。`SecurityContextHolder`默认使用 `ThreadLocal`策略来存储认证信息，即一种与线程绑定的策略，每个线程执行时都可以获取该线程中的 安全上下文(security context)，各个线程中的安全上下文互不影响。而且如果说要在请求结束后清除安全上下文中的信息，利用该策略Spring Security也可以轻松搞定。

因为身份信息时与线程绑定的，所以我们可以在程序的任何地方使用静态方法获取用户信息，一个获取当前登录用户的姓名的例子如下：  

```java
Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

if (principal instanceof UserDetails) {
String username = ((UserDetails)principal).getUsername();
} else {
String username = principal.toString();
}
```

`getAuthentication()`方法返回了认证信息，准确的说是一个 `Authentication`实例，`Authentication`是 Spring Security 中的一个重要接口，直接继承自 Principal类，该接口表示对用户身份信息的抽象，接口源码如下：  

```java
public interface Authentication extends Principal, Serializable { 
    //权限信息列表，默认是 GrantedAuthority接口的一些实现
    Collection<? extends GrantedAuthority> getAuthorities(); 
    //密码信息，用户输入的密码字符串，认证后通常会被移除，用于保证安全
    Object getCredentials();
    //细节信息，web应用中通常的接口为 WebAuthenticationDetails，它记录了访问者的ip地址和sessionId的值
    Object getDetails();
    //身份信息，返回UserDetails的实现类
    Object getPrincipal();
    //认证状态，默认为false,认证成功后为 true
    boolean isAuthenticated();
    //上述身份信息是否经过身份认证 
    void setAuthenticated(boolean var1) throws IllegalArgumentException;
}
```

### AuthenticationManager、ProviderManager 和 AuthenticationProvider

AuthenticationManager是身份认证器，认证的核心接口，接口源码如下：  

```java
public interface AuthenticationManager {
	/**
	 * Attempts to authenticate the passed {@link Authentication} object, returning a
	 * fully populated <code>Authentication</code> object (including granted authorities)
	 * @param authentication the authentication request object
	 *
	 * @return a fully authenticated object including credentials
	 *
	 * @throws AuthenticationException if authentication fails
	 */
	Authentication authenticate(Authentication authentication)
			throws AuthenticationException;
}
```

该接口只有一个 `authenticate()`方法，用于身份信息的认证，如果认证成功，将会返回一个带了完整信息的`Authentication`，在之前提到的`Authentication`所有的属性都会被填充。

在Spring Security中，`AuthenticationManager`默认的实现类是 `ProviderManager`，`ProviderManager`并不是自己直接对请求进行验证，而是将其委派给一个 `AuthenticationProvider`列表。列表中的每一个 `AuthenticationProvider`将会被依次查询是否需要通过其进行验证,每个 provider的验证结果只有两个情况：抛出一个异常或者完全填充一个 `Authentication`对象的所有属性。`ProviderManager`中的部分源码如下：  

```java
public class ProviderManager implements AuthenticationManager, MessageSourceAware,
		InitializingBean {

	//维护一个AuthenticationProvider 列表
	private List<AuthenticationProvider> providers = Collections.emptyList();
	private AuthenticationManager parent;
	//构造器，初始化 AuthenticationProvider 列表
	public ProviderManager(List<AuthenticationProvider> providers) {
		this(providers, null);
	}
	public ProviderManager(List<AuthenticationProvider> providers,
			AuthenticationManager parent) {
		Assert.notNull(providers, "providers list cannot be null");
		this.providers = providers;
		this.parent = parent;
		checkState();
	}
	public Authentication authenticate(Authentication authentication)
			throws AuthenticationException {
		Class<? extends Authentication> toTest = authentication.getClass();
		AuthenticationException lastException = null;
		Authentication result = null;
		boolean debug = logger.isDebugEnabled();
        // AuthenticationProvider 列表中每个Provider依次进行认证
		for (AuthenticationProvider provider : getProviders()) {
			if (!provider.supports(toTest)) {
				continue;
			}
            ...
			try { 
			    //调用 AuthenticationProvider 的 authenticate()方法进行认证
				result = provider.authenticate(authentication);
				if (result != null) {
					copyDetails(authentication, result);
					break;
				}
			}
			...
			catch (AuthenticationException e) {
				lastException = e;
			}
		}
        // 如果 AuthenticationProvider 列表中的Provider都认证失败，且之前有构造一个 AuthenticationManager 实现类，那么利用AuthenticationManager 实现类 继续认证
		if (result == null && parent != null) {
			// Allow the parent to try.
			try {
				result = parent.authenticate(authentication);
			}
            ...
			catch (AuthenticationException e) {
				lastException = e;
			}
		}
        //认证成功
		if (result != null) {
			if (eraseCredentialsAfterAuthentication
					&& (result instanceof CredentialsContainer)) {
				// Authentication is complete. Remove credentials and other secret data
				// from authentication
				//成功认证后删除验证信息
				((CredentialsContainer) result).eraseCredentials();
			}
            //发布登录成功事件
			eventPublisher.publishAuthenticationSuccess(result);
			return result;
		}

		// 没有认证成功，抛出一个异常
		if (lastException == null) {
			lastException = new ProviderNotFoundException(messages.getMessage(
					"ProviderManager.providerNotFound",
					new Object[] { toTest.getName() },
					"No AuthenticationProvider found for {0}"));
		}
		prepareException(lastException, authentication);
		throw lastException;
	}
```

ProviderManager中的 `authenticationManager`列表依次去尝试认证，认证成功即返回，认证失败返回null，如果所有的 Provider都认证失败， `ProviderManager`将会抛出一个 `ProviderNotFoundException`异常。

事实上，`AuthenticationProvider`是一个接口，接口定义如下：  

```java
public interface AuthenticationProvider {
    //认证方法
	Authentication authenticate(Authentication authentication)
			throws AuthenticationException;
    //该Provider是否支持对应的Authentication
	boolean supports(Class<?> authentication);
}
```

在 `ProviderManager`的 Javadoc曾提到,

> If more than one AuthenticationProvider supports the passed Authentication object, the first one able to successfully authenticate the Authentication object determines the result, overriding any possible AuthenticationException thrown by earlier supporting AuthenticationProvider s. On successful authentication, no subsequent AuthenticationProvider s will be tried. If authentication was not successful by any supporting AuthenticationProvider the last thrown AuthenticationException will be rethrown

大致意思是：

> 如果有多个 AuthenticationProvider 都支持同一个Authentication 对象，那么**第一个 能够成功验证Authentication的 Provder** 将填充其属性并返回结果，从而覆盖早期支持的 AuthenticationProvider抛出的任何可能的 AuthenticationException。一旦成功验证后，将不会尝试后续的 AuthenticationProvider。如果所有的 `AuthenticationProvider`都没有成功验证 Authentication，那么将抛出最后一个Provider抛出的AuthenticationException。(AuthenticationProvider可以在Spring Security配置类中配置)

**PS**:

> 当然有时候我们有多个不同的 `AuthenticationProvider`，它们分别支持不同的 `Authentication`对象，那么当一个具体的 `AuthenticationProvier`传进入 `ProviderManager`的内部时，就会在 `AuthenticationProvider`列表中挑选其对应支持的provider对相应的 Authentication对象进行验证。

不同的登录方式认证逻辑是不一样的，即 `AuthenticationProvider`会不一样，如果使用用户名和密码登录，那么在Spring Security 提供了一个 `AuthenticationProvider`的简单实现 `DaoAuthenticationProvider`，这也是框架最早的 provider，它使用了一个 `UserDetailsService`来查询用户名、密码和 `GrantedAuthority`，一般我们要实现`UserDetailsService`接口，，并在Spring Security配置类中将其配置进去，这样也促使使用`DaoAuthenticationProvider`进行认证，然后该接口返回一个`UserDetails`，它包含了更加详细的身份信息，比如从数据库拿取的密码和权限列表，AuthenticationProvider 的认证核心就是加载对应的 `UserDetails`来检查用户输入的密码是否与其匹配，即UserDetails和Authentication两者的密码（关于 `UserDetailsService`和`UserDetails`的介绍在下面小节介绍。）。**而如果是使用第三方登录，比如QQ登录，那么就需要设置对应的 `AuthenticationProvider`**，这里就不细说了。

#### 认证成功后清除验证信息

在上面ProviderManager的源码中我还发现一点，在认证成功后清除验证信息，如下：  

```java
if (eraseCredentialsAfterAuthentication
		&& (result instanceof CredentialsContainer)) {
	// Authentication is complete. Remove credentials and other secret data
	// from authentication
	//成功认证后删除验证信息
	((CredentialsContainer) result).eraseCredentials();
}
```

从 spring Security 3.1之后，在请求认证成功后 `ProviderManager`将会删除 `Authentication`中的认证信息，准确的说，一般删除的是 密码信息，这可以保证密码的安全。我跟了一下源码，实际上执行删除操作的步骤如下：  

```java
public class UsernamePasswordAuthenticationToken extends AbstractAuthenticationToken {
    public void eraseCredentials() {
        super.eraseCredentials();
        //使密码为null
        this.credentials = null;
    }
}
public abstract class AbstractAuthenticationToken implements Authentication, CredentialsContainer {
...
public void eraseCredentials() {
    //擦除密码
    this.eraseSecret(this.getCredentials());
    this.eraseSecret(this.getPrincipal());
    this.eraseSecret(this.details);
}

private void eraseSecret(Object secret) {
    if (secret instanceof CredentialsContainer) {
        ((CredentialsContainer)secret).eraseCredentials();
    }
 }
}
```

从源码就可以看出实际上就是擦除密码操作。

### UserDetailsService 和 UserDetails

**`UserDetailsService`简单说就是加载对应的`UserDetails`的接口(一般从数据库)，而`UserDetails`包含了更详细的用户信息**，定义如下：  

```java
public interface UserDetails extends Serializable {

   Collection<? extends GrantedAuthority> getAuthorities();

   String getPassword();

   String getUsername();

   boolean isAccountNonExpired();

   boolean isAccountNonLocked();

   boolean isCredentialsNonExpired();

   boolean isEnabled();
}
```

UserDetails 接口与 Authentication接口相似，它们都有 username、authorities。它们的区别如下：

*   Authentication 的 getCredentials() 与 UserDetails 中的 getPassword() 不一样，前者是用户提交的密码凭证，后者是用户正确的密码，(一般是从数据库中载入的密码)，`AuthenticationProvider`就会对两者进行对比。
*   Authentication 中的 getAuthorities() 实际上是由 UserDetails 的 getAuthorities()传递形成的。
*   Authentication 中的 getUserDetails() 中的 UserDetails 用户详细信息时经过 `AuthenticationProvider`认证之后填充的。

## 认证过程样本示例

下面来看一个[官方文档](https://docs.spring.io/spring-security/site/docs/current/reference/htmlsingle/#what-is-authentication-in-spring-security)提供的例子，代码如下：  

```java
public class SpringSecuriryTestDemo {
    private static AuthenticationManager am = new SampleAuthenticationManager();

    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        while (true) {
            System.out.println("Please enter your username:");
            String name = in.readLine();
            System.out.println("Please enter your password:");
            String password = in.readLine();
            try {
                Authentication request = new UsernamePasswordAuthenticationToken(name, password);
                Authentication result = am.authenticate(request);
                SecurityContextHolder.getContext().setAuthentication(request);
                break;
            } catch (AuthenticationException e) {
                System.out.println("Authentication failed: " + e.getMessage());
            }
        }
        System.out.println("Successfully authenticated. Security context contains: " + SecurityContextHolder.getContext().getAuthentication());
    }
    static class SampleAuthenticationManager implements AuthenticationManager {
        static final List<GrantedAuthority> AUTHORITIES = new ArrayList<GrantedAuthority>();
        static {
            AUTHORITIES.add(new SimpleGrantedAuthority("ROLE_USER"));
        }
        @Override
        public Authentication authenticate(Authentication authentication) throws AuthenticationException {
            if (authentication.getName().equals(authentication.getCredentials())) {
                return new UsernamePasswordAuthenticationToken(authentication.getName(), authentication.getCredentials(), AUTHORITIES);
            }
            throw new BadCredentialsException("Bad Credentials");
        }
    }
}
```

测试如下：  

```
Please enter your username:
pjmike
Please enter your password:
123
Authentication failed: Bad Credentials
Please enter your username:
pjmike
Please enter your password:
pjmike
Successfully authenticated. 
Security context contains: org.springframework.security.authentication.UsernamePasswordAuthenticationToken@441d0230:
Principal: pjmike; 
Credentials: [PROTECTED];
Authenticated: true; Details: null; 
Granted Authorities: ROLE_USER
```

上面的例子很简单，不是源码，只是为了演示认证过程编写的Demo，而且也缺少过滤器链，但是麻雀虽小，五脏俱全，基本包括了Spring Security的核心组件，表达了Spring Security 认证的基本思想。解读一下：

*   用户名和密码被封装到 `UsernamePasswordAuthentication`的实例中(该类是 `Authentication`接口的实现)
*   该 `Authentication`传递给 `AuthenticationManager`进行身份验证
*   认证成功后，`AuthenticationManager`会返回一个完全填充的 `Authentication`实例，该实例包含权限信息，身份信息，细节信息，但是密码通常会被移除
*   通过调用 `SecurityContextHolder.getContext().setAuthentication(…)`传入上面返回的填充了信息的 `Authentication`对象

通过上面一个简单示例，我们大致明白了Spring Security的基本思想，但是要真正理清楚Spring Security的认证流程这还不够，我们需要深入源码去探究，后续文章会更加详细的分析Spring Security的认证过程。

## 小结

这篇文章主要分析了Spring Security的一些核心组件，参考了官方文档及其相关译本，对核心组件有一个基本认识后，才便于后续更加详细的分析Spring Security的认证过程。

## 参考资料 & 鸣谢

*   [Spring Security Reference](https://docs.spring.io/spring-security/site/docs/current/reference/htmlsingle/#tech-intro-access-control)
*   [SPRING SECURITY 4官方文档中文翻译与源码解读](http://www.tianshouzhi.com/api/tutorials/spring_security_4/278)
*   [Spring Security(一)–Architecture Overview](https://www.cnkirito.moe/spring-security-1/)
