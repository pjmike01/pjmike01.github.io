---
title: "浅析MySQL InnoDB的隔离级别"
date: 2019-01-15
slug: "浅析MySQL-InnoDB的隔离级别"
tags: ["MySQL"]
lost_images:
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/read_committed.png"
  - "https://pjmike-1253796536.cos.ap-beijing.myqcloud.com/gap_lock.png"
---
## 前言

还是老规矩，首先提出几个待解决的问题：

*   MySQL InnoDB存储引擎中事务的隔离级别有哪些？
*   对应隔离级别的实现机制是什么？

本文就将对上面这两个问题进行解答，分析事务的隔离级别以及相关锁机制。

## 隔离性简介

隔离性主要是指数据库系统提供一定的隔离机制，保证事务在不受外部并发操作影响的”独立”环境执行，意思就是多个事务并发执行时，一个事务的执行不应影响其它事务的执行。

## 4种隔离级别介绍

在**SQL标准**中定义了4种隔离级别，分别是：

*   **Read uncommitted**: 未提交读，事务中的修改，即使没有提交，对其他事务也是可见的。存在脏读
*   **Read committed**: 提交读，大多数数据库系统的默认隔离级别(MySQL不是), 一个事务从开始到提交之前，所做的修改对其他事务不可见。解决脏读，存在幻读和不可重复读
*   **repeatable read**: 可重复读，该级别保证在同一事务中多次读取同样记录的结果是一致的。解决脏读和不可重复读，理论上存在幻读，但是在InnoDB引擎中解决了幻读
*   **Serializable**：可串行化，强制事务串行执行。

上面4种隔离级别是SQL标准定义的，但是在不同的存储引擎中，实现的隔离级别不尽相同。本文主要介绍MySQL InnoDB 存储引擎中的隔离级别，**在InnoDB存储引擎中，Repeatable Read 是默认的事务隔离级别，同时该引擎的实现基于多版本的并发控制协议——MVCC (Multi-Version Concurrency Control)，解决了幻读问题，当然 脏读和不可重复读也是不存在的**。MVCC最大的好处就在于读不加锁，读写不冲突，这样极大的增加了系统的并发性能

### Read uncommitted

未提交读，这种情况下，一个事务A可以看到另一个事务B未提交的数据，如果此时事务B发生回滚，那么事务A拿到的就是脏数据，这也就是脏读的含义。此隔离级别在MySQL InnoDB一般不会使用，不做过多说明。

### Read Committed

提交读，一个事务从开始直到提交之前，所做的任何修改对其他事务都是不可见的。解决了脏读问题，但是存在幻读现象。

**所谓幻读，指的是在同一事务下，连续执行两次同样的SQL语句可能导致不同的结果，第二次的SQL语句可能会返回之前不存在的行，也就是”幻行”**。

比如下面这个例子：

1.  首先创建一张表,
    
    ```
    CREATE TABLE `t` (
      `a` int(11) NOT NULL,
      PRIMARY KEY (`a`)
    ) ENGINE=InnoDB
    
    insert into t(a) values(1);
    insert into t(a) values(2);
    insert into t(a) values(4);
    ```
    
2.  分别执行事务1和事务2：
    

_\[配图已丢失: read\_committed.png\]_

可以从上图看出，Read Committed这种隔离级别存在幻读现象。实际上，Read Committed还可能存在不可重复读的问题，**不可重复读，指的是一个事务内根据同一条件对行记录进行多次查询，但是查询出的数据结果不一致，原因就是查询区间数据被其他事务修改了**。

不可重复读感觉和幻读有点像，实际上，**前者强调是同一行记录数据结果不一样，后者强调的时多次查询返回的结果集不一样，增加了或减少了**。

### Repeatable Read

可重复读，该级别保证在同一事务中多次读取同样记录的结果是一致的，在InnoDB存储引擎中同时解决了幻读和不可重复读问题。至于InnoDB通过什么方式解决幻读和不可重复读问题，后续内容揭晓。

### Serializable (可串行化)

Serializable 是最高的隔离级别，它通过 强制事务串行执行，避免了幻读的问题，但是 Serializable 会在读取的每一行数据上都加锁，所以可能导致大量的超时和锁争用的问题,因此并发度急剧下降，在MySQL InnoDB不被建议使用

## Read Committed隔离级别下的加锁分析

隔离级别的实现与锁机制密不可分，所以需要引入锁的概念，首先我们看下InnoDB存储引擎提供的两种标准的行级锁：

*   **共享锁(S Lock)**：又称为读锁，可以允许多个事务并发的读取同一资源，互不干扰。即如果一个事务T对数据A加上共享锁后，其他事务只能对A再加共享锁，不能再加排他锁，只能读数据，不能修改数据
*   **排他锁(X Lock)**: 又称为写锁，如果事务T对数据A加上排他锁后，其他事务不能再对A加上任何类型的锁，获取排他锁的事务既能读数据，也能修改数据。

注意： 共享锁和排他锁是不相容的。

**MySQL InnoDB存储引擎是使用多版本并发控制的，读不加锁，读写不冲突，除非特定场景下的显示加读锁（这里不去探究）**。本小节主要分析Read Committed隔离级别下的加锁情况，在MVCC的作用下，一般也就是写操作加X锁了。

加锁操作是和索引紧密相关的，对一个SQL语句进行加锁分析时，也要仔细考究其属性列上的索引类型。假设有数据表t1，有两个列，name列和id列，插入了几条数据，没有明确索引情况：  

```
insert into t1(name,id) values("a",10);
insert into t1(name,id) values("b",11);
insert into t1(name,id) values("c",13);
insert into t1(name,id) values("d",20);
```

下面执行 delete from t1 where id = 10 这条SQL语句，这里的隔离级别设置为Read Committed，从这条SQL语句不能得知id列的索引情况，所以需要分情况讨论：

*   id列是主键
*   id列是二级唯一索引
*   id列是二级非唯一索引
*   id列上没有索引

下面是对以上几种情况的加锁情况进行归纳总结，更详细的内容可以参阅数据库大牛的文章：[MySQL 加锁处理分析](http://hedengcheng.com/?p=771#_Toc374698307)

**id列是主键**

> id是主键时，上述SQL只需要在id=10这条记录上加X锁即可

**id列是二级唯一索引**

> 若id列是唯一索引，而主键是name列，那么SQL需要加上两个X锁，一个对应于id索引上的id=10的记录，另一把锁对应于主键索引上的\[name=”a”,id=10\]的记录

**id列是二级非唯一索引**

> 若id列上有非唯一索引，那么对应的所有满足SQL查询条件的记录，都会被加锁，同时，这些记录在主键索引上的记录也会被加锁。

**id列上没有索引**

> 若id列上没有索引，SQL会走聚簇索引的全扫描进行过滤，由于过滤是由MySQL Sever层面进行的，因此每条记录，无论是否满足条件，都会被加上X锁。

## Repeatable Read隔离级别下的加锁分析

前面说过，在Repeatable Read隔离级别下，InnoDB存储引擎解决了幻读和不可重复读问题，具体的原理是怎么样的呢？

之前简短的介绍了InnoDB中行锁的知识，下面来看下行锁的三种算法：

*   Record Lock: 单个索引记录上的锁，即加X锁
*   Gap Lock： 间隙锁，锁定一个范围，但不包含记录自身
*   Next-Key Lock: Gap Lock + Record Lock，锁定一个范围，并且锁定本身。

Record Lock总是会去锁住索引记录，如果InnoDB存储引擎在建表的时候没有设置任何一个索引，那么这时InnoDB会使用隐式的主键来进行锁定。(表没有定义主键的情况，InnoDB会默认添加一个隐式的主键索引)

Next-Key Lock是结合了Gap Lock和Record Lock的一种锁定算法，比如一个索引列有10,11,13和20这4个值，那么该索引可能被Next-Key Locking的区间为：

*   (`$-\infty$`,10)
*   (10,11\]
*   (11,13\]
*   (13,20\]
*   (20,`$+\infty$`)

需要注意一点的是，当查询的索引含有唯一属性时，即是主键索引或者唯一索引时，InnoDB存储引擎会对Next-Key Lock进行优化，将其降级为Record Lock,即仅锁住索引本身，一般加上X锁。

Next-Key Lock机制设计的目的就是为了解决幻读问题，主要针对查询列索引为非唯一索引的时候。以下面这个例子进行说明：

1.  首先创建测试表t1，name是主键索引，id为非唯一索引，即辅助索引
    
    ```
    CREATE TABLE `t1` (
      `id` int(11) NOT NULL,
      `name` varchar(200) DEFAULT NULL,
      PRIMARY KEY (`name`),
      KEY `id_indx` (`id`)
    ) ENGINE=InnoDB
    
    insert into t1(name,id) values("a",10);
    insert into t1(name,id) values("b",11);
    insert into t1(name,id) values("c",13);
    insert into t1(name,id) values("d",20);
    ```
    
2.  执行 delete from t1 where id = 11,其加锁情况如下图所示
    

_\[配图已丢失: gap\_lock.png\]_

这条SQL通过索引列id进行删除操作，该索引为非唯一索引，所以其使用传统的Next-Key  
Locking 技术加锁，并且由于有主键索引和辅助索引两个，需要分别进行锁定。对于主键索引（即聚集索引），其仅对列name = “b”的索引加上 Record Lock，实际上就是X锁。

而对于非唯一索引，其加上的时Next-Key Lock，锁定范围是(10,11)，对其加上Gap Lock(间隙锁)，GAP锁实际上就是加在两条边界记录之间的位置。还需要注意的是，InnoDB还会对辅助索引下一个键值加上gap lock，即看到在(11,13)之间加了一个GAP锁。对于11值本身加上Record Lock，即X锁。

若此时开启另外一个事务执行下面的语句，就会阻塞：  

```
1. select * from t1 where name = "b";
2. insert into t1(name,id) values("c",12);
```

比如第一条语句不能执行，因为在开始的事务中已经对聚集索引中的列name=”b”的值加上了X锁。因此执行会被阻塞。而第二个SQL，同样不能执行，插入的值12在锁定范围(11,13)中，需要阻塞等待。

所以，从上例就可以看出，GAP Lock的作用就是为了阻止多个事务将记录插入到同一范围内，这样就有效的解决了幻读问题。

## 隔离级别总结

下面总结下**InnoDB存储引擎下**的各种隔离级别：

隔离级别

脏读可能性

不可重复读可能性

幻读可能性

加锁读

Read Uncommitted

Yes

Yes

Yes

No

Read Committed

No

Yes

Yes

No

Repeatable Read

No

No

No

No

Serializable

No

No

No

Yes

## 参考资料 & 鸣谢

*   [MySQL技术内幕:InnoDB存储引擎(第2版)](https://book.douban.com/subject/24708143/)
*   [MySQL 加锁处理分析](http://hedengcheng.com/?p=771)
