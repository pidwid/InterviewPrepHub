# Appendix

> Reference material from [The System Design Primer](https://github.com/donnemartin/system-design-primer).
> Powers of two and latency numbers are also covered in detail in [24-Estimation-Numbers.md](24-Estimation-Numbers.md).

---

## Table of Contents

1. [Powers of Two Table](#1-powers-of-two-table)
2. [Latency Numbers Every Programmer Should Know](#2-latency-numbers-every-programmer-should-know)
3. [Additional System Design Interview Questions](#3-additional-system-design-interview-questions)
4. [Real World Architectures](#4-real-world-architectures)
5. [Company Architectures](#5-company-architectures)
6. [Company Engineering Blogs](#6-company-engineering-blogs)

---

## 1. Powers of Two Table

```
Power           Exact Value         Approx Value        Bytes
---------------------------------------------------------------
7                             128
8                             256
10                           1024   1 thousand           1 KB
16                         65,536                       64 KB
20                      1,048,576   1 million            1 MB
30                  1,073,741,824   1 billion            1 GB
32                  4,294,967,296                        4 GB
40              1,099,511,627,776   1 trillion           1 TB
```

### Source(s) and Further Reading

- [Powers of two (Wikipedia)](https://en.wikipedia.org/wiki/Power_of_two)

---

## 2. Latency Numbers Every Programmer Should Know

```
Latency Comparison Numbers
--------------------------
L1 cache reference                           0.5 ns
Branch mispredict                            5   ns
L2 cache reference                           7   ns             14x L1 cache
Mutex lock/unlock                           25   ns
Main memory reference                      100   ns             20x L2 cache, 200x L1 cache
Compress 1K bytes with Zippy            10,000   ns       10 us
Send 1 KB bytes over 1 Gbps network     10,000   ns       10 us
Read 4 KB randomly from SSD*           150,000   ns      150 us  ~1GB/sec SSD
Read 1 MB sequentially from memory     250,000   ns      250 us
Round trip within same datacenter      500,000   ns      500 us
Read 1 MB sequentially from SSD*     1,000,000   ns    1,000 us    1 ms  ~1GB/sec SSD, 4X memory
HDD seek                            10,000,000   ns   10,000 us   10 ms  20x datacenter roundtrip
Read 1 MB sequentially from 1 Gbps  10,000,000   ns   10,000 us   10 ms  40x memory, 10X SSD
Read 1 MB sequentially from HDD     30,000,000   ns   30,000 us   30 ms  120x memory, 30X SSD
Send packet CA->Netherlands->CA    150,000,000   ns  150,000 us  150 ms

Notes
-----
1 ns = 10^-9 seconds
1 us = 10^-6 seconds = 1,000 ns
1 ms = 10^-3 seconds = 1,000 us = 1,000,000 ns
```

### Handy Metrics

- Read sequentially from HDD at 30 MB/s
- Read sequentially from 1 Gbps Ethernet at 100 MB/s
- Read sequentially from SSD at 1 GB/s
- Read sequentially from main memory at 4 GB/s
- 6-7 world-wide round trips per second
- 2,000 round trips per second within a data center

### Source(s) and Further Reading

- [Latency numbers every programmer should know — 1](https://gist.github.com/jboner/2841832)
- [Latency numbers every programmer should know — 2](https://gist.github.com/hellerbarde/2843375)
- [Designs, lessons, and advice from building large distributed systems](http://www.cs.cornell.edu/projects/ladis2009/talks/dean-keynote-ladis2009.pdf)
- [Software Engineering Advice from Building Large-Scale Distributed Systems](https://static.googleusercontent.com/media/research.google.com/en//people/jeff/stanford-295-talk.pdf)

---

## 3. Additional System Design Interview Questions

Common system design interview questions, with links to resources on how to solve each.

| Question | Resource(s) |
|----------|-------------|
| Design a file sync service like Dropbox | [youtube.com](https://www.youtube.com/watch?v=PE4gwstWhmc) |
| Design a search engine like Google | [queue.acm.org](http://queue.acm.org/detail.cfm?id=988407) · [stackexchange.com](http://programmers.stackexchange.com/questions/38324/interview-question-how-would-you-implement-google-search) · [ardendertat.com](http://www.ardendertat.com/2012/01/11/implementing-search-engines/) · [stanford.edu](http://infolab.stanford.edu/~backrub/google.html) |
| Design a scalable web crawler like Google | [quora.com](https://www.quora.com/How-can-I-build-a-web-crawler-from-scratch) |
| Design Google Docs | [code.google.com](https://code.google.com/p/google-mobwrite/) · [neil.fraser.name](https://neil.fraser.name/writing/sync/) |
| Design a key-value store like Redis | [slideshare.net](http://www.slideshare.net/daborber/intro-aborber) |
| Design a cache system like Memcached | [slideshare.net](https://www.slideshare.net/oemlouveira/memcached-presentation-as-part-of-nosql-talk-at-qcon-sao-paulo/) |
| Design a recommendation system like Amazon's | [hulu.com](http://tech.hulu.com/blog/2011/09/19/recommendation-system.html) · [ijcai13.org](http://ijcai13.org/files/tutorial_slides/td3.pdf) |
| Design a tinyurl system like Bitly | [n00tc0d3r.blogspot.com](http://n00tc0d3r.blogspot.com/) |
| Design a chat app like WhatsApp | [highscalability.com](http://highscalability.com/blog/2014/2/26/the-whatsapp-architecture-facebook-bought-for-19-billion.html) |
| Design a picture sharing system like Instagram | [highscalability.com (1)](http://highscalability.com/flickr-architecture) · [highscalability.com (2)](http://highscalability.com/blog/2011/12/6/instagram-architecture-14-million-users-terabytes-of-photos.html) |
| Design the Facebook news feed function | [quora.com (1)](http://www.quora.com/What-are-best-practices-for-building-something-like-a-News-Feed) · [quora.com (2)](http://www.quora.com/Activity-Streams/What-are-the-scaling-issues-to-keep-in-mind-while-developing-a-social-network-feed) · [slideshare.net](http://www.slideshare.net/danmckinley/etsy-activity-feeds-architecture) |
| Design the Facebook timeline function | [facebook.com](https://www.facebook.com/note.php?note_id=10150468255628920) · [highscalability.com](http://highscalability.com/blog/2012/1/23/facebook-timeline-brought-to-you-by-the-power-of-denormaliza.html) |
| Design the Facebook chat function | [erlang-factory.com](https://www.erlang-factory.com/upload/presentations/31/EugeneLetuchy-ErsssPresentationsSF2010-702.pdf) · [facebook.com](https://www.facebook.com/note.php?note_id=14218138919&id=9445547199&index=0) |
| Design a graph search function like Facebook's | [facebook.com (1)](https://www.facebook.com/notes/facebook-engineering/under-the-hood-building-out-the-infrastructure-for-graph-search/10151347573598920) · [facebook.com (2)](https://www.facebook.com/notes/facebook-engineering/under-the-hood-indexing-and-ranking-in-graph-search/10151361720763920) · [facebook.com (3)](https://www.facebook.com/notes/facebook-engineering/under-the-hood-the-natural-language-interface-of-graph-search/10151432733048920) |
| Design a content delivery network like CloudFlare | [figshare.com](https://figshare.com/articles/Globally_distributed_content_delivery/6605972) |
| Design a trending topic system like Twitter's | [michael-noll.com](http://www.michael-noll.com/blog/2013/01/18/implementing-real-time-trending-topics-in-storm/) · [snikolov.wordpress.com](http://snikolov.wordpress.com/2012/11/14/early-detection-of-twitter-trends/) |
| Design a random ID generation system | [blog.twitter.com](https://blog.twitter.com/2010/announcing-snowflake) · [github.com](https://github.com/twitter/snowflake/) |
| Return the top k requests during a time interval | [cs.ucsb.edu](https://www.cs.ucsb.edu/sites/default/files/documents/2005-23.pdf) · [wpi.edu](http://wpi.edu/Pubs/ETD/Available/etd-070207-085208/unrestricted/mfenner.pdf) |
| Design a system that serves data from multiple data centers | [highscalability.com](http://highscalability.com/blog/2009/8/24/how-google-serves-data-from-multiple-datacenters.html) |
| Design an online multiplayer card game | [indieflashblog.com](http://www.indieflashblog.com/how-to-create-an-asynchronous-multiplayer-game.html) · [buildnewgames.com](http://www.게임.com/) |
| Design a garbage collection system | [stuffwithstuff.com](http://journal.stuffwithstuff.com/2013/12/08/babys-first-garbage-collector/) · [washington.edu](http://courses.cs.washington.edu/courses/csep521/07wi/prj/rick.pdf) |
| Design an API rate limiter | [stripe.com](https://stripe.com/blog/rate-limiters) |
| Design a Stock Exchange (like NASDAQ or Binance) | [Jane Street](https://www.janestreet.com/tech-talks/anatomy-of-a-trading-system/) · [Go Implementation](https://around25.com/blog/building-a-stock-exchange/) |

---

## 4. Real World Architectures

Articles on how real world systems are designed.

> Don't focus on nitty gritty details for the following articles, instead:
> - Identify shared principles, common technologies, and patterns within these articles
> - Study what problems are solved by each component, where it works, where it doesn't
> - Review the lessons learned

### Data Processing

| System | Description | Resource |
|--------|-------------|----------|
| MapReduce | Distributed data processing from Google | [research.google.com](http://static.googleusercontent.com/media/research.google.com/zh-CN/us/archive/mapreduce-osdi04.pdf) |
| Spark | Distributed data processing from Databricks | [slideshare.net](https://www.slideshare.net/AGaborinski/spark-presentation-54178027) |
| Storm | Distributed data processing from Twitter | [slideshare.net](http://www.slideshare.net/preaborber/storm-16702009) |

### Data Stores

| System | Description | Resource |
|--------|-------------|----------|
| Bigtable | Distributed column-oriented database from Google | [harvard.edu](http://www.read.seas.harvard.edu/~kohler/class/cs239-w08/chang06bigtable.pdf) |
| HBase | Open source implementation of Bigtable | [slideshare.net](https://www.slideshare.net/enis_soz/hbase-and-hdfs-understanding-filesystem-usage) |
| Cassandra | Distributed column-oriented database from Facebook | [slideshare.net](http://www.slideshare.net/planetcassandra/cassandra-introduction-features-30702702) |
| DynamoDB | Document-oriented database from Amazon | [harvard.edu](http://www.read.seas.harvard.edu/~kohler/class/cs239-w08/decandia07dynamo.pdf) |
| MongoDB | Document-oriented database | [slideshare.net](https://www.slideshare.net/mdirolf/introduction-to-mongodb) |
| Spanner | Globally-distributed database from Google | [research.google.com](http://research.google.com/archive/spanner-osdi2012.pdf) |
| Memcached | Distributed memory caching system | [slideshare.net](https://www.slideshare.net/oemlouveira/memcached-presentation-as-part-of-nosql-talk-at-qcon-sao-paulo/) |
| Redis | Distributed memory caching system with persistence and value types | [slideshare.net](https://www.slideshare.net/daborber/intro-aberder) |

### File Systems

| System | Description | Resource |
|--------|-------------|----------|
| Google File System (GFS) | Distributed file system | [research.google.com](http://static.googleusercontent.com/media/research.google.com/zh-CN/us/archive/gfs-sosp2003.pdf) |
| Hadoop File System (HDFS) | Open source implementation of GFS | [apache.org](http://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html) |

### Misc

| System | Description | Resource |
|--------|-------------|----------|
| Chubby | Lock service for loosely-coupled distributed systems from Google | [research.google.com](http://static.googleusercontent.com/external_content/untrusted_dlcp/research.google.com/en/us/archive/chubby-osdi06.pdf) |
| Dapper | Distributed systems tracing infrastructure | [research.google.com](http://static.googleusercontent.com/media/research.google.com/en/us/pubs/archive/36356.pdf) |
| Kafka | Pub/sub message queue from LinkedIn | [slideshare.net](http://www.slideshare.net/mumaborber/kafka-presentation-13702040) |
| Zookeeper | Centralized infrastructure and services enabling synchronization | [slideshare.net](https://www.slideshare.net/saborber/introduction-to-apache-zookeeper) |

---

## 5. Company Architectures

| Company | Article(s) |
|---------|-----------|
| Amazon | [Amazon architecture](http://highscalability.com/amazon-architecture) |
| Cinchcast | [Producing 1,500 hours of audio every day](http://highscalability.com/blog/2012/7/16/cinchcast-architecture-producing-1500-hours-of-audio-every-d.html) |
| DataSift | [Realtime datamining at 120,000 tweets per second](http://highscalability.com/blog/2011/11/29/datasift-architecture-realtime-datamining-at-120000-tweets-pe.html) |
| Dropbox | [How we've scaled Dropbox](https://www.youtube.com/watch?v=PE4gwstWhmc) |
| ESPN | [Operating at 100,000 duh nuh nuhs per second](http://highscalability.com/blog/2013/11/4/espns-architecture-at-scale-operating-at-100000-duh-nuh-nuhs.html) |
| Google | [Google architecture](http://highscalability.com/google-architecture) |
| Instagram | [14 million users, terabytes of photos](http://highscalability.com/blog/2011/12/6/instagram-architecture-14-million-users-terabytes-of-photos.html) · [What powers Instagram](http://instagram-engineering.tumblr.com/post/13649370142/what-powers-instagram-hundreds-of-instances) |
| Justin.tv | [Justin.Tv's live video broadcasting architecture](http://highscalability.com/blog/2010/3/16/justintvs-live-video-broadcasting-architecture.html) |
| Facebook | [Scaling memcached at Facebook](https://cs.uwaterloo.ca/~brecht/courses/854-Emerging-2014/readings/key-value/fb-memcached-nsdi-2013.pdf) · [TAO: Facebook's distributed data store for the social graph](https://cs.uwaterloo.ca/~brecht/courses/854-Emerging-2014/readings/data-store/tao-facebook-distributed-datastore-atc-2013.pdf) · [Facebook's photo storage](https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Beaver.pdf) · [How Facebook Live Streams to 800,000 Simultaneous Viewers](http://highscalability.com/blog/2016/6/27/how-facebook-live-streams-to-800000-simultaneous-viewers.html) |
| Flickr | [Flickr architecture](http://highscalability.com/flickr-architecture) |
| Mailbox | [From 0 to one million users in 6 weeks](http://highscalability.com/blog/2013/6/18/scaling-mailbox-from-0-to-one-million-users-in-6-weeks-and-1.html) |
| Netflix | [A 360 Degree View Of The Entire Netflix Stack](http://highscalability.com/blog/2015/11/9/a-360-degree-view-of-the-entire-netflix-stack.html) · [Netflix: What Happens When You Press Play?](http://highscalability.com/blog/2017/12/11/netflix-what-happens-when-you-press-play.html) |
| Pinterest | [From 0 To 10s of billions of page views a month](http://highscalability.com/blog/2013/4/15/scaling-pinterest-from-0-to-10s-of-billions-of-page-views-a.html) · [18 million visitors, 10x growth, 12 employees](http://highscalability.com/blog/2012/5/21/pinterest-architecture-update-18-million-visitors-10x-growth.html) |
| Playfish | [50 million monthly users and growing](http://highscalability.com/blog/2010/9/21/playfishs-social-gaming-architecture-50-million-monthly-user.html) |
| PlentyOfFish | [PlentyOfFish architecture](http://highscalability.com/plentyoffish-architecture) |
| Salesforce | [How they handle 1.3 billion transactions a day](http://highscalability.com/blog/2013/9/23/salesforce-architecture-how-they-handle-13-billion-transacti.html) |
| Stack Overflow | [Stack Overflow architecture](http://highscalability.com/blog/2009/8/5/stack-overflow-architecture.html) |
| TripAdvisor | [40M visitors, 200M dynamic page views, 30TB data](http://highscalability.com/blog/2011/6/27/tripadvisor-architecture-40m-visitors-200m-dynamic-page-MDash.html) |
| Tumblr | [15 billion page views a month](http://highscalability.com/blog/2012/2/13/tumblr-architecture-15-billion-page-views-a-month-and-harder.html) |
| Twitter | [Making Twitter 10000 percent faster](http://highscalability.com/scaling-twitter-making-twitter-10000-percent-faster) · [Storing 250 million tweets a day using MySQL](http://highscalability.com/blog/2011/12/19/how-twitter-stores-250-million-tweets-a-day-using-mysql.html) · [150M active users, 300K QPS, a 22 MB/S firehose](http://highscalability.com/blog/2013/7/8/the-architecture-twitter-uses-to-deal-with-150m-active-users.html) · [Timelines at scale](https://www.infoq.com/presentations/Twitter-Timeline-Scalability) · [Big and small data at Twitter](https://www.youtube.com/watch?v=5cKTP36HVgI) · [Operations at Twitter: scaling beyond 100 million users](https://www.youtube.com/watch?v=z8LU0Cj6BOU) |
| Uber | [How Uber scales their real-time market platform](http://highscalability.com/blog/2015/9/14/how-uber-scales-their-real-time-market-platform.html) · [Lessons Learned From Scaling Uber To 2000 Engineers, 1000 Services, And 8000 Git Repositories](http://highscalability.com/blog/2016/10/12/lessons-learned-from-scaling-uber-to-2000-engineers-1000-ser.html) |
| WhatsApp | [The WhatsApp architecture Facebook bought for $19 billion](http://highscalability.com/blog/2014/2/26/the-whatsapp-architecture-facebook-bought-for-19-billion.html) |
| YouTube | [YouTube scalability](https://www.youtube.com/watch?v=w5WVu624fY8) · [YouTube architecture](http://highscalability.com/youtube-architecture) |

---

## 6. Company Engineering Blogs

> Architectures for companies you are interviewing with.
> Questions you encounter might be from the same domain.

| Company | Blog |
|---------|------|
| Airbnb | [Airbnb Engineering](http://nerds.airbnb.com/) |
| Atlassian | [Atlassian Developers](https://developer.atlassian.com/blog/) |
| AWS | [AWS Blog](https://aws.amazon.com/blogs/aws/) |
| Bitly | [Bitly Engineering Blog](http://word.bitly.com/) |
| Box | [Box Blogs](https://blog.box.com/blog/category/engineering) |
| Cloudera | [Cloudera Developer Blog](http://blog.cloudera.com/) |
| Dropbox | [Dropbox Tech Blog](https://tech.dropbox.com/) |
| Ebay | [Ebay Tech Blog](http://www.ebaytechblog.com/) |
| Evernote | [Evernote Tech Blog](https://blog.evernote.com/tech/) |
| Etsy | [Etsy Code as Craft](http://codeascraft.com/) |
| Facebook | [Facebook Engineering](https://www.facebook.com/Engineering) |
| Flickr | [Flickr Code](http://code.flickr.net/) |
| Foursquare | [Foursquare Engineering Blog](http://engineering.foursquare.com/) |
| GitHub | [GitHub Engineering Blog](https://github.blog/category/engineering) |
| Google | [Google Research Blog](http://googleresearch.blogspot.com/) |
| Groupon | [Groupon Engineering Blog](https://engineering.groupon.com/) |
| Heroku | [Heroku Engineering Blog](https://engineering.heroku.com/) |
| Hubspot | [Hubspot Engineering Blog](http://product.hubspot.com/blog/topic/engineering) |
| High Scalability | [High Scalability](http://highscalability.com/) |
| Instagram | [Instagram Engineering](http://instagram-engineering.tumblr.com/) |
| Intel | [Intel Software Blog](https://software.intel.com/en-us/blogs/) |
| Jane Street | [Jane Street Tech Blog](https://blogs.janestreet.com/category/ocaml/) |
| LinkedIn | [LinkedIn Engineering](http://engineering.linkedin.com/blog) |
| Microsoft | [Microsoft Engineering](https://engineering.microsoft.com/) |
| Microsoft Python | [Microsoft Python Engineering](https://blogs.msdn.microsoft.com/pythonengineering/) |
| Netflix | [Netflix Tech Blog](http://techblog.netflix.com/) |
| Paypal | [Paypal Developer Blog](https://medium.com/paypal-engineering) |
| Pinterest | [Pinterest Engineering Blog](https://medium.com/@Pinterest_Engineering) |
| Reddit | [Reddit Blog](http://www.redditblog.com/) |
| Salesforce | [Salesforce Engineering Blog](https://developer.salesforce.com/blogs/engineering/) |
| Slack | [Slack Engineering Blog](https://slack.engineering/) |
| Spotify | [Spotify Labs](https://labs.spotify.com/) |
| Stripe | [Stripe Engineering Blog](https://stripe.com/blog/engineering) |
| Twilio | [Twilio Engineering Blog](http://www.twilio.com/engineering) |
| Twitter | [Twitter Engineering](https://blog.twitter.com/engineering/) |
| Uber | [Uber Engineering Blog](http://eng.uber.com/) |
| Yahoo | [Yahoo Engineering Blog](http://yahooeng.tumblr.com/) |
| Yelp | [Yelp Engineering Blog](http://engineeringblog.yelp.com/) |
| Zynga | [Zynga Engineering Blog](https://www.zynga.com/blogs/engineering) |

### Source(s) and Further Reading

- [kilimchoi/engineering-blogs](https://github.com/kilimchoi/engineering-blogs) — A curated list of engineering blogs.
