---
title: "springboot系列文章之编写七牛云的自定义starter"
date: 2018-08-21
slug: "springboot系列文章之编写七牛云的自定义starter"
tags: ["springboot"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/qi.png"
  - "http://osvtz719h.bkt.clouddn.com/jietu.png"
---
**Catalogue**

1.  [1. springboot的自动配置](#springboot的自动配置)
    1.  [1.1. spring-boot-autoconfigure 依赖](#spring-boot-autoconfigure-依赖)
    2.  [1.2. @EnableAutoConfiguration](#EnableAutoConfiguration)
    3.  [1.3. @Conditional条件注解](#Conditional条件注解)
2.  [2. 自定义七牛云的starter](#自定义七牛云的starter)
3.  [3. 小结](#小结)
4.  [4. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## springboot的自动配置

编写自定义starter之前，先来简要介绍下springboot的自动配置的相关特征。

### spring-boot-autoconfigure 依赖

spring-boot-autoconfigure 依赖,是Spring Boot实现自动配置的核心Starter组件，它的工作原理很简单，通过`@EnableAutoConfiguration`让SpringBoot根据类路径中的jar包依赖为当前项目进行自动配置，例如，添加了`spring-boot-starter-web` 依赖，会自动添加Tomcat和Spring MVC的依赖，那么Spring Boot会对Tomcat和Spring MVC进行自动配置

### @EnableAutoConfiguration

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

@EnableAutoConfiguration注解通过@Import注解导入的配置功能，AutoConfigurationImportSelector利用SpringFactoriesLoader.loadFactoryNames方法来扫描具有META-INF/spring.factories文件的jar包，将所有符合条件的自动配置类加载到IoC容器中，更多关于此注解的介绍请参阅之前的文章 ：[springboot系列文章之SpringBootApplication注解](https://juejin.im/post/5b778945f265da436b524043)

### @Conditional条件注解

在SpringBoot的自动配置中大量使用了条件注解，拿Spring AOP的自动配置类来说:  

```java
@Configuration
@ConditionalOnClass({ EnableAspectJAutoProxy.class, Aspect.class, Advice.class,
		AnnotatedElement.class })
@ConditionalOnProperty(prefix = "spring.aop", name = "auto", havingValue = "true", matchIfMissing = true)
public class AopAutoConfiguration {

	@Configuration
	@EnableAspectJAutoProxy(proxyTargetClass = false)
	@ConditionalOnProperty(prefix = "spring.aop", name = "proxy-target-class", havingValue = "false", matchIfMissing = false)
	public static class JdkDynamicAutoProxyConfiguration {

	}

	@Configuration
	@EnableAspectJAutoProxy(proxyTargetClass = true)
	@ConditionalOnProperty(prefix = "spring.aop", name = "proxy-target-class", havingValue = "true", matchIfMissing = true)
	public static class CglibAutoProxyConfiguration {

	}

}
```

在这个类中就使用了`@ConditionalOnClass`,`@ConditionalOnProperty`等条件注解。这些条件注解都是组合了 `@Conditional`这个元注解来的，只是使用了不同的条件(Condition)。

`@Conditional`根据满足某一个特定条件创建一个特定的Bean，比如说，当某一个jar包在一个类路径下时，自动创建一个或者多个Bean。如果要自定义判断条件，我们就需要实现 Condition 接口，并重写其 matches 方法来构造判断条件  

```java
public class QiNiuYunCondition implements Condition {
    private static Logger logger = LoggerFactory.getLogger(QiNiuYunCondition.class);
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        String property = context.getEnvironment().getProperty("qiniuyun.accessKey");
        if (StringUtils.isEmpty(property)) {
            throw new RuntimeException("没有七牛云的配置");
        } else {
            return true;
        }
    }
}


@Configuration
@Conditional(QiNiuYunCondition.class)
public class QiNiuYunServiceAutoConfiguration {
    ....
}
```

有很多基于`@Conditional`的组合注解常常用于自动配置中，比如:

*   @ConditionalOnBean（仅仅在当前容器中存在某个对象时，才会实例化一个Bean）
*   @ConditionalOnClass（当容器中某个class位于类路径上，才会实例化一个Bean）
*   @ConditionalOnExpression（当表达式为true的时候，才会实例化一个Bean）
*   @ConditionalOnMissingBean（仅仅在当前容器中不存在某个对象时，才会实例化一个Bean,容器不能实例化两次）
*   @ConditionalOnMissingClass（某个class类路径上不存在的时候，才会实例化一个Bean）
*   @ConditionalOnNotWebApplication（不是web应用）
*   @ConditionalOnProperty: 指定的属性是否有指定的值，使用prefix和name属性指定要检查的配置
*   @ConditionalOnResource: 只在特定资源出现时才会包含配置

官方文档上关于自动配置这块也有详细的解析: [https://docs.spring.io/spring-boot/docs/1.4.1.RELEASE/reference/htmlsingle/#boot-features-custom-starter](https://docs.spring.io/spring-boot/docs/1.4.1.RELEASE/reference/htmlsingle/#boot-features-custom-starter)

## 自定义七牛云的starter

下面进入这篇文章的主要目的，编写七牛云的starter,主要分为以下几个步骤

**1\. 在pom文件中添加七牛云相关依赖以及spring-boot-autoconfigure**  

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>com.qiniu</groupId>
        <artifactId>qiniu-java-sdk</artifactId>
        <version>7.2.11</version>
        <scope>compile</scope>
    </dependency>
    <dependency>
        <groupId>com.squareup.okhttp3</groupId>
        <artifactId>okhttp</artifactId>
        <version>3.3.1</version>
        <scope>compile</scope>
    </dependency>
    <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>2.6.2</version>
        <scope>compile</scope>
    </dependency>
    <dependency>
        <groupId>com.qiniu</groupId>
        <artifactId>happy-dns-java</artifactId>
        <version>0.1.4</version>
        <scope>compile</scope>
    </dependency>
</dependencies>
```

1.  **设置七牛云的配置**

因为在后面的过程中需要使用到相关属性，这里将七牛云的一些属性设置了默认值  

```java
@Component
@ConfigurationProperties(prefix = "qiniuyun")
public class QiNiuYunProperties {
    /**
     * 七牛云的密钥
     */
    private String accessKey = "accessKey_test";
    private String secretKey = "secretKey_test";
    /**
     * 存储空间名字
     */
    private String bucket = "bucket_test";
    /**
     * 一般设置为cdn
     */
    private String cdnPrefix = "cdn";

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getCdnPrefix() {
        return cdnPrefix;
    }

    public void setCdnPrefix(String cdnPrefix) {
        this.cdnPrefix = cdnPrefix;
    }
}
```

通过`@ConfigurationProperties`加载 properties 文件内的配置，通过 prefix 属性指定 properties 的配置的前缀，还可以通过 locations 指定 properties 文件的位置

**3\. 定义七牛云服务接口及实现类**  

```java
public interface IQiNiuYunService {
    /**
     * 上传文件
     * <p>文件上传</p>
     *
     * @param file
     * @return
     * @throws QiniuException
     */
    Response uploadFile(File file, String name) throws QiniuException;

    /**
     * 上传文件
     * <p>文件流上传</p>
     *
     * @param inputStream
     * @return
     * @throws QiniuException
     */
    Response uploadFile(InputStream inputStream, String name) throws QiniuException;

    /**
     * 删除
     *
     * @param key
     * @return
     * @throws QiniuException
     */
    Response delete(String key) throws QiniuException;
}
```

实现类:  

```java
package com.pjmike.qiniuyun;

import com.qiniu.common.QiniuException;
import com.qiniu.http.Response;
import com.qiniu.storage.BucketManager;
import com.qiniu.storage.UploadManager;
import com.qiniu.util.Auth;
import com.qiniu.util.StringMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.InputStream;

/**
 * @author pjmike
 * @create 2018-08-20 12:02
 */
@Service
public class IQiNiuYunServiceImpl implements IQiNiuYunService{
    @Autowired
    private UploadManager uploadManager;
    @Autowired
    private BucketManager bucketManager;
    @Autowired
    private Auth auth;
    @Autowired
    private QiNiuYunProperties qiNiuProperties;

    private StringMap putPolicy;
    @Override
    public Response uploadFile(File file, String name) throws QiniuException {
        Response response = this.uploadManager.put(file, name, getUploadToken(name));
        int retry = 0;
        while (response.needRetry() && retry < 3) {
            response = this.uploadManager.put(file, name, getUploadToken());
            retry++;
        }
        return response;
    }
    @Override
    public Response uploadFile(InputStream inputStream, String name) throws QiniuException {
        Response response = this.uploadManager.put(inputStream, name, getUploadToken(), null, null);
        int retry = 0;
        while (response.needRetry() && retry < 3) {
            response = this.uploadManager.put(inputStream, name, getUploadToken(), null, null);
            retry++;
        }
        return response;
    }
    @Override
    public Response delete(String key) throws QiniuException {
        Response response = bucketManager.delete(qiNiuProperties.getBucket(), key);
        int retry = 0;
        while (response.needRetry() && retry++ < 3) {
            response = bucketManager.delete(qiNiuProperties.getBucket(), key);
        }
        return response;
    }

    @PostConstruct
    public void init() {
        this.putPolicy = new StringMap();
        putPolicy.put("returnBody", "{\"key\":\"$(key)\",\"hash\":\"$(etag)\",\"bucket\":\"$(bucket)\",\"width\":$(imageInfo.width), \"height\":${imageInfo.height}}");
    }

    /**
     * 获取上传凭证
     *
     * @return
     */
    private String getUploadToken(String fileName) {
        return this.auth.uploadToken(qiNiuProperties.getBucket(),fileName,3600,putPolicy);
    }
    private String getUploadToken() {
        return this.auth.uploadToken(qiNiuProperties.getBucket(),null,3600,putPolicy);
    }
}
```

**4\. 自动配置类**  

```java
package com.pjmike.qiniuyun;

import com.google.gson.Gson;
import com.qiniu.common.Zone;
import com.qiniu.storage.BucketManager;
import com.qiniu.storage.UploadManager;
import com.qiniu.util.Auth;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


/**
 * 自动配置
 *
 * @author pjmike
 * @create 2018-08-20 12:06
 */
@Configuration
//启动配置文件
@EnableConfigurationProperties(QiNiuYunProperties.class)
//判断IQiNiuYunService这个类是否在类路径中存在，且当容器中没有这个Bean的情况下自动配置这个Bean
@ConditionalOnClass(IQiNiuYunService.class)
//存在配置前缀qiniuyun,开启,缺失检查
@ConditionalOnProperty(prefix = "qiniuyun",value = "enabled",matchIfMissing = true)
public class QiNiuYunServiceAutoConfiguration {
    @Autowired
    private QiNiuYunProperties qiNiuYunProperties;

    @Bean
    @ConditionalOnMissingBean(IQiNiuYunServiceImpl.class)
    public IQiNiuYunService qiNiuYunService() {
        return new IQiNiuYunServiceImpl();
    }
    /**
     * 华东   Zone.zone0()
     * 华北   Zone.zone1()
     * 华南   Zone.zone2()
     * 北美   Zone.zoneNa0()
     */
    @Bean
    public com.qiniu.storage.Configuration qiniuConfig() {
        return new com.qiniu.storage.Configuration(Zone.zone0());
    }

    /**
     * 构建一个七牛上传工具实例
     *
     * @return
     */
    @Bean
    public UploadManager uploadManager() {
        return new UploadManager(qiniuConfig());
    }

    /**
     * 认证信息实例
     *
     * @return
     */
    @Bean
    public Auth auth() {
        return Auth.create(qiNiuYunProperties.getAccessKey(), qiNiuYunProperties.getSecretKey());
    }

    /**
     * 构建七牛空间管理实例
     *
     * @return
     */
    @Bean
    public BucketManager bucketManager() {
        return new BucketManager(auth(), qiniuConfig());
    }

    /**
     * 配置gson为json解析工具
     *
     * @return
     */
    @Bean
    public Gson gson() {
        return new Gson();
    }

}
```

**6\. 关键的一步，在src/main/resources下新建META-INF/spring.factories (注意文件名不要拼错)，加入这个AutoCOnfiguration**  

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.pjmike.qiniuyun.QiNiuYunServiceAutoConfiguration
```

若有多个自动配置，则用”,”隔开，此处 “ \\ “ 是为了换行后仍然能读到属性

**7\. 测试**

新建一个 `springboot` 项目，加入这个`spring-boot-starter-qiniuyun`  

1  
2  
3  
4  
5  

<dependency>  
    <groupId>com.pjmike</groupId>  
    <artifactId>spring-boot-starter-qiniuyun</artifactId>  
    <version>0.0.1-SNAPSHOT</version>  
</dependency>  

测试application.properties配置,开启debug的模式，可以看到`QiNiuYunServiceAutoConfiguration`被加载到IoC容器中  

```java
# 七牛云配置
qiniuyun.accessKey=o7RfCh2VChV-6f7WYyewxUzTiSx4HXXXXXXXXXX
qiniuyun.secretKey=xuo5ZLwesoIopOgm8hZGtKphM5PxKYXXXXXXXXXXXXX
qiniuyun.bucket=photoespj
qiniuyun.cdnPrefix=cdn

server.port=8880
debug=true
```

_\[配图已丢失: qi.png\]_

controller类:  

```java
package com.pjmike.qiniu.controller;

import com.google.gson.Gson;
import com.pjmike.qiniuyun.IQiNiuYunService;
import com.pjmike.qiniuyun.IQiNiuYunServiceImpl;
import com.qiniu.http.Response;
import com.qiniu.storage.model.DefaultPutRet;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * @author pjmike
 * @create 2018-08-20 15:06
 */
@RestController
public class QiNiuYunController {
    @Autowired
    private IQiNiuYunService qiNiuYunService;
    @RequestMapping("/upload")
    public String upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return "file is empty";
        }
        //原始名
        String originalFileName = file.getOriginalFilename();
        Response response = qiNiuYunService.uploadFile(file.getInputStream(), originalFileName);
        DefaultPutRet putRet = new Gson().fromJson(response.bodyString(), DefaultPutRet.class);
        return "fileName : " + putRet.key;
    }
}
```

测试结果如图:  

_\[配图已丢失: jietu.png\]_

## 小结

以上简单的制作了一个关于七牛云的starter，对于七牛云的集成是参阅了七牛云的[Java SDK的开发文档](https://developer.qiniu.com/kodo/sdk/1239/java)。所以，如果想了解更多七牛云的开发细则，请参阅相关开发文档。

PS: starter GitHub地址: [https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-qiniuyun-starter](https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-qiniuyun-starter)

## 参考资料 & 鸣谢

*   [spring boot 参考手册](https://qbgbook.gitbooks.io/spring-boot-reference-guide-zh/content/IV.%20Spring%20Boot%20features/43.3.4%20Resource%20conditions.html)
*   [七牛云 Java SDK](https://developer.qiniu.com/kodo/sdk/1239/java)
