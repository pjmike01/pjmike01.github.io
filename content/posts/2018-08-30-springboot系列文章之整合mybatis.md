---
title: "springboot系列文章之整合mybatis"
date: 2018-08-30
slug: "springboot系列文章之整合mybatis"
tags: ["mybatis", "springboot"]
---
**Catalogue**

1.  [1. mybatis简介](#mybatis简介)
2.  [2. 项目依赖](#项目依赖)
3.  [3. 配置文件](#配置文件)
    1.  [3.1. 分页插件配置](#分页插件配置)
4.  [4. 逆向工程——Mybatis Generator](#逆向工程——Mybatis-Generator)
    1.  [4.1. 在数据库创建测试表](#在数据库创建测试表)
    2.  [4.2. 配置Mybatis 代码生成工具的配置文件](#配置Mybatis-代码生成工具的配置文件)
    3.  [4.3. 使用 Java编码的方式运行 MBG](#使用-Java编码的方式运行-MBG)
    4.  [4.4. 使用Maven执行MBG](#使用Maven执行MBG)
    5.  [4.5. 生成的实体类](#生成的实体类)
    6.  [4.6. Mapper接口](#Mapper接口)
    7.  [4.7. Mapper文件](#Mapper文件)
5.  [5. 测试代码](#测试代码)
6.  [6. 小结](#小结)
7.  [7. 参考文章 & 鸣谢](#参考文章-amp-鸣谢)

## mybatis简介

> MyBatis 是一款优秀的持久层框架，它支持定制化 SQL、存储过程以及高级映射。MyBatis 避免了几乎所有的 JDBC 代码和手动设置参数以及获取结果集。MyBatis 可以使用简单的 XML 或注解来配置和映射原生信息，将接口和 Java 的 POJOs(Plain Old Java Objects,普通的  
> Java对象)映射成数据库中的记录。

关于SpringBoot与Mybatis的整合，我将使用[通用 Mapper](https://github.com/abel533/Mapper/wiki)与[Mybatis分页插件](https://github.com/pagehelper/Mybatis-PageHelper)这两个插件，这两个插件能够帮助我们更加方便与高效的使用Mybatis。

## 项目依赖

需要加入通用Mapper，分页插件以及代码生成器的依赖  

```xml
<dependencies>
       <dependency>
           <groupId>org.springframework.boot</groupId>
           <artifactId>spring-boot-starter</artifactId>
       </dependency>
       <!--引入该starter时，和mybatis官方的starter没有冲突，但是官方的自动配置不会生效-->
       <dependency>
           <groupId>tk.mybatis</groupId>
           <artifactId>mapper-spring-boot-starter</artifactId>
           <version>1.2.4</version>
       </dependency>
       <!--mysql依赖-->
       <dependency>
           <groupId>mysql</groupId>
           <artifactId>mysql-connector-java</artifactId>
       </dependency>
       <!--分页插件依赖-->
       <dependency>
           <groupId>com.github.pagehelper</groupId>
           <artifactId>pagehelper-spring-boot-starter</artifactId>
           <version>1.2.5</version>
       </dependency>
       <dependency>
           <groupId>org.springframework.boot</groupId>
           <artifactId>spring-boot-starter-test</artifactId>
           <scope>test</scope>
       </dependency>
       <!--代码生成器依赖-->
       <dependency>
           <groupId>org.mybatis.generator</groupId>
           <artifactId>mybatis-generator-core</artifactId>
           <version>1.3.5</version>
       </dependency>
   </dependencies>
```

## 配置文件

```yml

# mybatis自身配置
mybatis:
  type-aliases-package: com.pjmike.mybatis.model
  mapper-locations: classpath:mapper/*.xml
  # 驼峰命名规范
  configuration:
    map-underscore-to-camel-case: true

# 通用mapper配置
mapper:
  mappers: com.pjmike.mybatis.MyMapper
  not-empty: false
  # 主键自增回写，默认为 MYSQL
  identity: MYSQL
# 分页插件配置
pagehelper:
  helper-dialect: mysql
  reasonable: true
  support-methods-arguments: true
  params: count=countSql
spring:
  datasource:
    driver-class-name: com.mysql.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/demo?useUnicode=true&characterEncoding=utf8
    username: root
    password: root
```

### 分页插件配置

*   helperDialect: 分页插件会自动检测当前的数据库连接，自动选择合适的分页方式。你可以配置helperDialect属性来指定分页插件使用哪种方言。比如，这里我们设置的是 mysql。
*   reasonable: 分页合理化参数，默认值为 false ,当参数设置为 true时，pageNum<=0 时会查询第一页， pageNum>pages（超过总数时），会查询最后一页。默认false 时，直接根据参数进行查询。
*   supportMethodsArguments： 支持通过 Mapper 接口参数来传递分页参数，默认值false，分页插件会从查询方法的参数值中，自动根据上面 params 配置的字段中取值，查找到合适的值时就会自动分页。

更多分页插件的配置请参阅 官方文档: [https://github.com/pagehelper/Mybatis-PageHelper/blob/master/wikis/zh/HowToUse.md](https://github.com/pagehelper/Mybatis-PageHelper/blob/master/wikis/zh/HowToUse.md)

## 逆向工程——Mybatis Generator

mybatis的一个特点就是需要开发者自己去编写 SQL语句，如果表非常多的话，难免会很麻烦，所以 mybatis官方推出一个逆向工程，可以针对数据库单表逆向生成 mybatis需要的代码(实体类，Mapper接口，XML文件)，具体做法是使用Mybatis Generator插件生成实体类，Mapper接口以及对应的XML文件

### 在数据库创建测试表

```
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB
```

### 配置Mybatis 代码生成工具的配置文件

在创建的Web工程中，创建相应的 package如下:

*   com.pjmike.mybatis.dao : 用来存放Mapper接口对象
*   com.pjmike.mybatis.model： 用来存放实体类
*   src/main/resources/mapper: 用来存放对应的mapper文件

将Mybatis 代码生成器的配置文件放在 resouces下面，此处命名为 generatorConfig.xml，内容如下:  

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE generatorConfiguration
        PUBLIC "-//mybatis.org//DTD MyBatis Generator Configuration 1.0//EN"
        "http://mybatis.org/dtd/mybatis-generator-config_1_0.dtd">

<generatorConfiguration>
    <context id="MysqlContext" targetRuntime="MyBatis3Simple" defaultModelType="flat">
        <property name="beginningDelimiter" value="`"/>
        <property name="endingDelimiter" value="`"/>

        <plugin type="tk.mybatis.mapper.generator.MapperPlugin">
            <property name="mappers" value="com.pjmike.mybatis.MyMapper"/>
        </plugin>

        <jdbcConnection driverClass="com.mysql.jdbc.Driver"
                        connectionURL="jdbc:mysql://127.0.0.1:3306/demo"
                        userId="root"
                        password="root">
        </jdbcConnection>

        <!-- 对于生成的pojo所在包 -->
        <javaModelGenerator targetPackage="com.pjmike.mybatis.model" targetProject="src/main/java">
            <property name="immutable" value="false"/>
        </javaModelGenerator>

		<!-- 对于生成的mapper所在目录 -->
        <sqlMapGenerator targetPackage="mapper" targetProject="src/main/resources"/>

		<!-- 配置mapper对应的java映射 -->
        <javaClientGenerator targetPackage="com.pjmike.mybatis.dao" targetProject="src/main/java"
                             type="XMLMAPPER"/>
        <table tableName="user">
            <generatedKey column="id" sqlStatement="MySql" identity="true"/>
        </table>
    </context>
</generatorConfiguration>
```

更多关于 generatorConfig.xml 配置相关的介绍，请参阅官方文档: [http://mbg.cndocs.ml/running/running.html](http://mbg.cndocs.ml/running/running.html)

### 使用 Java编码的方式运行 MBG

这里有两种方法可以运行Mybatis Generator插件，第一种是直接建立一个创建一个类，添加 main()方法，在主函数中执行。如下所示:  

```java
public class GeneratorDisplay {

    public void generator() throws Exception{

        List<String> warnings = new ArrayList<>();
        boolean overwrite = true;
        //指定 逆向工程配置文件
        File configFile = new File("F:\\IDEAproject\\spring-boot-learn\\spring-boot-mybatis\\src\\main\\resources\\generatorConfig.xml");
        ConfigurationParser cp = new ConfigurationParser(warnings);
        Configuration config = cp.parseConfiguration(configFile);
        DefaultShellCallback callback = new DefaultShellCallback(overwrite);
        MyBatisGenerator myBatisGenerator = new MyBatisGenerator(config,
                callback, warnings);
        myBatisGenerator.generate(null);

    }

    public static void main(String[] args) throws Exception {
        try {
            GeneratorDisplay generatorSqlmap = new GeneratorDisplay();
            generatorSqlmap.generator();
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
}
```

### 使用Maven执行MBG

利用Maven来执行Mybatis Generator,首先在 pom.xml配置生成器插件:  

```xml
<plugin>
        <groupId>org.mybatis.generator</groupId>
        <artifactId>mybatis-generator-maven-plugin</artifactId>
        <version>1.3.2</version>
        <configuration>
            <configurationFile>${basedir}/src/main/resources/generatorConfig.xml</configurationFile>
            <overwrite>true</overwrite>
            <verbose>true</verbose>
        </configuration>
        <dependencies>
            <dependency>
                <groupId>mysql</groupId>
                <artifactId>mysql-connector-java</artifactId>
                <version>5.1.45</version>
            </dependency>
            <dependency>
                <groupId>tk.mybatis</groupId>
                <artifactId>mapper</artifactId>
                <version>3.5.3</version>
            </dependency>
        </dependencies>
</plugin>
```

注意要在插件里面包含 通用Mapper版本和数据库连接依赖。接下来是运行该插件，在pom.xml所在目录的命令行窗口执行 `mvn mybatis-generator:generator`。

### 生成的实体类

```java
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String username;

    private String password;

    /**
     * @return id
     */
    public Integer getId() {
        return id;
    }

    /**
     * @param id
     */
    public void setId(Integer id) {
        this.id = id;
    }

    /**
     * @return username
     */
    public String getUsername() {
        return username;
    }

    /**
     * @param username
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * @return password
     */
    public String getPassword() {
        return password;
    }

    /**
     * @param password
     */
    public void setPassword(String password) {
        this.password = password;
    }
}
```

### Mapper接口

```java
import com.pjmike.mybatis.MyMapper;
import com.pjmike.mybatis.model.User;

public interface UserMapper extends MyMapper<User> {
}
```

### Mapper文件

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd" >
<mapper namespace="com.pjmike.mybatis.dao.UserMapper" >
  <resultMap id="BaseResultMap" type="com.pjmike.mybatis.model.User" >
    <!--
      WARNING - @mbg.generated
    -->
    <id column="id" property="id" jdbcType="INTEGER" />
    <result column="username" property="username" jdbcType="VARCHAR" />
    <result column="password" property="password" jdbcType="VARCHAR" />
  </resultMap>
</mapper>
```

从上面我们就可以看出 MBG 是非常方便的，它不需要我们去手动建立实体类，Mapper接口以及对应的XML配置文件，对于开发者来说非常友好，让我们省去了很多工作。

## 测试代码

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserMapperTest {
    private static final Logger logger = LoggerFactory.getLogger(UserMapperTest.class);
    @Autowired
    private UserMapper userMapper;
    @Test
    public void userTest() {
        User user = new User();
        user.setUsername("pjmike");
        user.setPassword("123456");
        userMapper.insert(user);
        logger.info("查询插入的用户信息: {}",userMapper.selectOne(user));

        //模拟分页
        for (int i = 0; i < 20; i++) {
            userMapper.insertSelective(new User("pjmike" + i, "123456" + i));
        }
        PageInfo<User> pageInfo = PageHelper.startPage(1, 10).setOrderBy("id desc").doSelectPageInfo(() -> this.userMapper.selectAll());
        logger.info("[lambda写法]-[分页信息]-[{}]", pageInfo.toString());

        PageHelper.startPage(1, 10).setOrderBy("id desc");
        PageInfo<User> pageInfo1 = new PageInfo<>(this.userMapper.selectAll());
        logger.info("[普通写法]-[分页信息]-[{}]",pageInfo1.toString());
    }
}
```

## 小结

mybatis是一个优秀的 ORM 框架，在开发中，**配合通用Mapper，分页插件以及Mybatis Generator 插件使用**，是一件非常 nice的事情，它将更加高效地帮助你开发。

源代码地址: [https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-mybatis](https://github.com/pjmike/spring-boot-learn/tree/master/spring-boot-mybatis)

## 参考文章 & 鸣谢

*   [MYBATIS GENERATOR 插件](https://mapperhelper.github.io/docs/3.usembg/)
*   [mybatis 官方文档](http://www.mybatis.org/mybatis-3/)
