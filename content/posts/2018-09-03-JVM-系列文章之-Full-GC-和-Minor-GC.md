---
title: "JVM 系列文章之 Full GC 和 Minor GC"
date: 2018-09-03
slug: "JVM-系列文章之-Full-GC-和-Minor-GC"
tags: ["JVM", "Java"]
lost_images:
  - "http://osvtz719h.bkt.clouddn.com/YGCcross.png"
---
**Catalogue**

1.  [1. Full GC](#Full-GC)
    1.  [1.1. Full GC的触发条件](#Full-GC的触发条件)
2.  [2. Minor GC](#Minor-GC)
    1.  [2.1. 触发条件](#触发条件)
    2.  [2.2. Minor GC的过程](#Minor-GC的过程)
    3.  [2.3. Survivor区对象晋升位老年代对象的条件](#Survivor区对象晋升位老年代对象的条件)
    4.  [2.4. Minor GC的问题与卡表分析](#Minor-GC的问题与卡表分析)
        1.  [2.4.1. JVM如何避免Minor GC扫描全堆](#JVM如何避免Minor-GC扫描全堆)
3.  [3. 关于 Major GC的说明](#关于-Major-GC的说明)
4.  [4. 小结](#小结)
5.  [5. 参考资料 & 鸣谢](#参考资料-amp-鸣谢)

## Full GC

**Full GC 就是收集整个堆，包括新生代，老年代，永久代(在JDK 1.8及以后，永久代会被移除，换为metaspace)等收集所有部分的模式**

**RednaxelaFX大**在[Major GC和Full GC的区别是什么？触发条件呢？- 知乎](https://www.zhihu.com/question/41922036/answer/93079526)这个问题有关于 GC分类的回答：

针对 HotSpot VM的实现，它里面的GC其实准确分类有两种:

*   **Partial GC(局部 GC)**: 并不收集整个 GC 堆的模式
    *   Young GC: 只收集young gen的GC，**Young GC还有种说法就叫做 “Minor GC”**
    *   Old GC: 只收集old gen的GC。只有垃圾收集器CMS的concurrent collection 是这个模式
    *   Mixed GC: 收集整个young gen 以及部分old gen的GC。只有垃圾收集器 G1有这个模式
*   **Full GC**: 收集整个堆，包括 新生代，老年代，永久代(在 JDK 1.8及以后，永久代被移除，换为metaspace 元空间)等所有部分的模式

### Full GC的触发条件

针对不同的垃圾收集器，Full GC的触发条件可能不都一样。**按HotSpot VM的serial GC的实现来看**，触发条件是:

*   > **当准备要触发一次 young GC时，如果发现统计数据说之前 young GC的平均晋升大小比目前的 old gen剩余的空间大，则不会触发young GC而是转为触发 full GC** (因为HotSpot VM的GC里，除了垃圾回收器 CMS的concurrent collection 之外，其他能收集old gen的GC都会同时收集整个GC堆，包括young gen，所以不需要事先准备一次单独的young GC)
    
*   > **如果有永久代(perm gen),要在永久代分配空间但已经没有足够空间时，也要触发一次 full GC**
    
*   > **System.gc()，heap dump带GC,其默认都是触发 full GC.**
    

HotSpot VM里其他非并发GC的触发条件复杂一些，不过大致原理与上面说的其实一样。

而**在 Parallel Scavenge 收集器下，默认是在要触发 full GC前先执行一次 young GC**,并且两次GC之间能让应用程序稍微运行一小下，以期降低 full GC的暂停时间 (因为 young GC 会尽量清理了young gen的死对象，减少了 full GC的工作量)。**控制这个行为的VM参数是: -XX:+ScavengeBeforeFullGC**。

并发GC的触发条件就不一样，**以 CMS GC为例，它主要是定时去检查old gen的使用量，但使用量超过了触发比例就会启动一次 CMS GC，对old gen做并发收集**。

## Minor GC

Minor GC 是俗称，**新生代(新生代分为一个 Eden区和两个Survivor区)的垃圾收集叫做 Minor GC**。在 Oracle 高级研究员郑雨迪的[极客时间专栏 《深入拆解Java虚拟机》](https://time.geekbang.org/column/intro/108)中也谈到 **Minor GC**，内容如下:

### 触发条件

> 当 Eden 区的空间耗尽了怎么办？这个时候 Java虚拟机便会触发一次 **Minor GC**来收集新生代的垃圾，存活下来的对象，则会被送到 Survivor区。

**简单说就是当新生代的Eden区满的时候触发 Minor GC**

### Minor GC的过程

> 前面提到，**新生代共有 两个 Survivor区，我们分别用 from 和 to来指代**。其中 to 指向的Survivor区是空的。

> 当发生 Minor GC时，Eden 区和 from 指向的 Survivor 区中的存活对象会被复制(此处采用标记 - 复制算法)到 to 指向的 Survivor区中，然后**交换 from 和 to指针，以保证下一次 Minor GC时，to 指向的 Survivor区还是空的**。

**注意: from与to只是两个指针，它们变动的，to指针指向的Survivor区是空的**

### Survivor区对象晋升位老年代对象的条件

> Java虚拟机会记录 Survivor区中的对象一共被来回复制了几次。**如果一个对象被复制的次数为 15 (对应虚拟机参数 -XX:+MaxTenuringThreshold),那么该对象将被晋升为至老年代**，(至于为什么是 15次，原因是 HotSpot会在对象头的中的标记字段里记录年龄，分配到的空间只有4位，所以最多只能记录到15)。另外，**如果单个 Survivor 区已经被占用了 50% (对应虚拟机参数: -XX:TargetSurvivorRatio)，那么较高复制次数的对象也会被晋升至老年代。**

**当Survivor区的部分对象晋升到老年代后，老年代的占用量通常会升高。**

**注意**：

在Minor GC过程中，Survivor 可能不足以容纳Eden和另一个Survivor中的存活对象。如果Survivor中的存活对象溢出，多余的对象将被移到老年代，这称为**过早提升(Premature Promotion)**，这会导致老年代中短期存活对象的增长，可能会引发严重的性能问题。再进一步说，在Minor GC过程中，如果老年代满了而无法容纳更多的对象，Minor GC 之后通常就会进行Full GC,这将导致遍历整个Java堆，这称为**提升失败(Promotion Failure)**。至于解决办法，这就涉及到对应用程序的调优问题了，这里就不叙述了，如有兴趣，请自行查阅相关资料

### Minor GC的问题与卡表分析

**Minor GC存在一个问题就是，老年代的对象可能引用新生代的对象**，在标记存活对象的时候，就需要扫描老年代的对象，如果该对象拥有对新生代对象的引用，那么这个引用也会被作为 GC Roots。这相当于就做了**全堆扫描**。

#### JVM如何避免Minor GC扫描全堆

HotSpot 给出的解决方案是 一项叫做 **卡表** 的技术。如下图所示:  

_\[配图已丢失: YGCcross.png\]_

卡表的具体策略是**将老年代的空间分成大小为 512B的若干张卡，并且维护一个卡表，卡表本省是字节数组，数组中的每个元素对应着一张卡，其实就是一个标识位，这个标识位代表对应的卡是否可能存有指向新生代对象的引用**，如果可能存在，那么我们认为这张卡是脏的，即**脏卡**。如上图所示，卡表3被标记为脏。

**在进行Minor GC的时候，我们便可以不用扫描整个老年代，而是在卡表中寻找脏卡，并将脏卡中的老年代指向新生代的引用加入到 Minor GC的GC Roots里，当完成所有脏卡的扫描之后，Java 虚拟机便会将所有脏卡的标识位清零。这样虚拟机以空间换时间，避免了全表扫描**

## 关于 Major GC的说明

除了Full GC和Minor GC外，还有一种说法叫做 “Major GC”：

> Major GC通常是跟full GC是等价的，收集整个GC堆，但因为 HotSpot VM发展这么多年，外界对各种名词的解读已经完全混乱了，当有人说”Major GC”的时候一定要问清楚他想要指的是上面的 full GC还是 old GC

以上是 R大关于 Major GC的说法，比较权威的。在网上还流行着**另外一种说法就是 Major GC是对老年代的垃圾回收**。

## 小结

以上的内容基本上是从 R大的知乎回答与[极客时间专栏 《深入拆解Java虚拟机》](https://time.geekbang.org/column/intro/108)总结来的，在总结过程中，也算是对 Full GC 与 Minor GC 有了一个基本的认识。

取之网络，再回馈之网络，本人对于JVM是渣渣级选手，如有错误之处，欢迎指教

## 参考资料 & 鸣谢

*   [Major GC和Full GC的区别是什么？触发条件呢？- 知乎-RednaxelaFX的回答](https://www.zhihu.com/question/41922036/answer/93079526)
*   [极客时间专栏 《深入拆解Java虚拟机》](https://time.geekbang.org/column/intro/108)
*   [从实际案例聊聊Java应用的GC优化-美团技术团队](https://tech.meituan.com/jvm_optimize.html)
*   [译文-Minor GC vs Major GC vs Full GC](https://segmentfault.com/a/1190000007723051)
