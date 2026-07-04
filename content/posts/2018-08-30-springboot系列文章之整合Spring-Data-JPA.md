---
title: "springboot系列文章之整合Spring Data JPA"
date: 2018-08-30
slug: "springboot系列文章之整合Spring-Data-JPA"
tags: ["spring data jpa", "springboot"]
---
**Catalogue**

1.  [1. JPA简介](#JPA简介)
2.  [2. Spring Data JPA简介](#Spring-Data-JPA简介)
3.  [3. 导入依赖](#导入依赖)
4.  [4. 数据库配置](#数据库配置)
5.  [5. 创建实体类](#创建实体类)
6.  [6. 创建Repository对象](#创建Repository对象)
7.  [7. 测试](#测试)
8.  [8. 小结](#小结)
9.  [9. 参考文章 & 鸣谢](#参考文章-amp-鸣谢)

## JPA简介

首先来介绍一下JPA，JPA是 `Java Persistence API`的简称，中文名称为 Java持久层API,是官方(Sun)在JDK5.0后提出的Java 持久化规范，其目的是为了简化Java EE和Java SE的应用开发工作。可以通过注解或者XML描述之间的映射关系，将实体对象持久化到数据库中。

JPA仅仅是一种规范，它仅仅定义了一些接口，而接口是需要实现才能工作，所以底层需要某种实现，而Hibernate 就是实现了 JPA 接口的ORM框架

## Spring Data JPA简介

Spring Data JPA 是Spring 提供的一套简化 JPA 开发的框架。**Spring Data JPA 可以理解为 JPA规范的再次封装抽象，底层还是使用了Hibernate的JPA实现**。Spring Data Repository 极大地简化了实现各种持久层的数据访问而写的样板代码，同时 CrudReposity 提供了丰富的CRUD 功能去管理实体类。

**优点**

*   丰富的API，简单操作无需编写额外的代码
*   丰富的SQL日志输出

**缺点**

*   学习成本大，需要学习HQL(Hibernate 查询语言)
*   配置复杂，关系映射多表查询不容易
*   性能较差，对比 `JdbcTemplate`,`Mybatis`等ORM框架，它的性能是最差的

## 导入依赖

```xml
<!--spring data jpa 依赖-->
<dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<!--数据库依赖-->
<dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <scope>runtime</scope>
</dependency>
```

springboot的版本信息:  

```xml
<parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.0.4.RELEASE</version>
        <relativePath/> <!-- lookup parent from repository -->
</parent>
```

## 数据库配置

在 `application.yml`中配置:  

```xml
spring:
  datasource:
    driver-class-name: com.mysql.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/demo?useUnicode=true&characterEncoding=utf8
    username: root
    password: root
  jpa:
    # 数据库类型
    database: mysql
    # 输出日志
    show-sql: true
    properties:
      hibernate:
        # JPA配置
        hbm2ddl.auto: update
```

SpringBoot默认会自动配置DataSource,它将优先采用 `HikariCP`连接池，如果没有该依赖的情况下则选取 `tomcat-jdbc` ，如果前两者都不可用最后选取 `Commons DBCP2`

**spring.jpa.properties.hibernate.hbm2ddl.auto的几个属性**

*   create: 每次运行程序时，重新创建数据库表结构，这就是导致数据库表数据丢失的原因
*   create-drop: 运行程序时创建表，程序结束时删除表结构
*   update: **每次运行程序，没有表时会创建表，如果对象发生改变会更新表结构，原有数据不会变，只会更新(推荐使用)**
*   validate: 运行程序会校验数据与数据库的字段类型是否相同，**字段不同会报错**

## 创建实体类

```java
@Entity
public class Person {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String content;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
```

创建实体类需要注意的几个注解:

**@Entity**

@Entity 标签表示该类是个JPA识别的实体类

**@Id**

JPA规范注解是在 `javax.persistence` 包下，`@Id`注解一定不要引用错了，否则会报错。

**@GeneratedValue**

该注解设置自增策略，常见的几种自增策略:

*   TABLE: 使用一个特定的数据库表格来保存主键
*   SEQUENCE: 根据底层数据库的序列来生成主键，条件时数据库支持序列。MySQL不支持这种方式
*   IDENTITY：主键由数据库自动生成，MySQL支持
*   AUTO： 主键由程序控制，自动选择一个最适合底层数据库的主键生成策略，如MySQL会自动对应 autoincrement。这个是@GenerateValue注解的默认值

## 创建Repository对象

```java
@Repository
public interface PersonRepository extends JpaRepository<Person,Integer> {

}
```

**Spring Data JPA的核心接口是Repository,它是一个空接口，没有包含方法声明的接口**。

Repository有几个子接口:

*   **CrudRepository**: 继承Repository,实现了CRUD相关的方法。我们需要的插入操作就包含在内。
*   **PagingAndSortingRepository**：继承自 CrudRepository，同时实现了分页排序的相关方法
*   **JpaRepository**: 继承自PagingAndSortingRepository，实现了JPA规范相关的方法。平时开发过程中，自己写接口直接继承JpaRepository就能获得绝大多数的功能。

## 测试

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class PersonRepositoryTest {
    private static final Logger logger = LoggerFactory.getLogger(PersonRepositoryTest.class);
    @Autowired
    private PersonRepository personRepository;
    @Test
    public void testPerson() {
        Person person = new Person();
        person.setUsername("pjmike");
        person = personRepository.save(person);
        logger.info("添加成员: {}",person);
        Person user = personRepository.findByUsername("pjmike");
        logger.info("条件查询: {}",user);
    }
}
```

## 小结

在我们日常开发中，用的比较多的ORM框架就是 mybatis和JPA，对于这两者如何选型，[http://www.spring4all.com/article/391](http://www.spring4all.com/article/391) 这篇文章有详细的讨论，个人更偏向使用 mybatis开发，mybatis比 jpa更灵活。另外，网上也有很多Spring Data JPA的教程，这里难免有参考涉及的地方，表示感谢

源代码地址: [https://github.com/pjmike/spring-boot-learn/tree/master/spring-data-jpa](https://github.com/pjmike/spring-boot-learn/tree/master/spring-data-jpa)

## 参考文章 & 鸣谢

*   [一起来学SpringBoot | 第六篇：整合SpringDataJpa](http://blog.battcn.com/2018/05/08/springboot/v2-orm-jpa/)
*   [Spring Data JPA - Reference Documentation](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
*   [如何对 JPA 或者 MyBatis 进行技术选型](http://www.spring4all.com/article/391)
