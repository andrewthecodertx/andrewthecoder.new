---
title: 'Object Oriented Programming, A Primer'
slug: object-oriented-programming
publishDate: '2026-05-15'
description: 'A brief overvue of the object oriented programming paradigm'
categories: ['Software Development']
tags: ['oop', 'paradigms', 'software development']
author: Andrew
comments_enabled: true
featured: true
image: '/assets/blog/oop.webp'
---

Object-oriented programming, or **OOP**, is one of those ideas that gets explained
in a way that makes it sound more mysterious than it really is.

At a basic level, OOP is just a way of organizing code around things in your system.
In a social media app, those things might be users, posts, comments, notifications,
and messages. Instead of treating the whole program like one long list of instructions,
you model the parts of the system as objects with their own data and behavior.

That sounds abstract at first, but it becomes much easier to understand when you
tie it to something familiar.

## Starting with Objects

Imagine you are building a social media platform. You already think in terms of
recognizable pieces: a user can publish a post, a post can receive likes, a comment
can belong to a post, and a notification can be sent when something happens. OOP
leans into that natural way of thinking.

A class is a blueprint. An object is an actual instance created from that blueprint.
If `User` is a class, then `alex` and `maria` are objects made from it.

```text
CLASS User
    username
    followersCount

    FUNCTION post(message)
        PRINT username + " posted: " + message
END CLASS

alex = NEW User(username="alex", followersCount=120)
alex.post("Hello world!")
```

The class describes what a user is supposed to have and what a user is supposed
to do. The object is the concrete thing your program works with at runtime.

## The Part People Miss

One of the most interesting things about OOP is that it is not just about bundling
data and methods together. There is a deeper idea underneath it: objects interact
by sending messages.

That way of thinking is closely associated with Alan Kay, who is one of the people
most strongly connected to the early development of object-oriented programming.
He later pointed out that the phrase “object-oriented programming” can mislead
people, because the really important part is not just the objects themselves.
It is the messaging between them.

In plain terms, one object asks another object to do something, and the receiving
object decides how to respond. That sounds simple, but it changes the way you
design software.

For example, suppose someone likes a post.

```text
post1 = NEW Post(author="alex", content="Big announcement")

// Not ideal:
post1.likes = post1.likes + 1

// Better:
post1.like()
```

That `like()` call is a message. It says, in effect, “someone liked this post.”
The post object handles the change internally. The outside world does not need
to know how likes are stored or updated. That separation is a big part of why
OOP can help keep systems from turning into a mess.

You can think of a social media application as a network of these interactions.

```text
user.follow(creator)
    → creator.addFollower(user)

creator.publishPost("New video is live")
    → notificationService.notifyFollowers(creator.followers)

notificationService.notifyFollowers(list)
    → FOR each follower IN list
          follower.notify("New post available")
```

Seen this way, OOP is less about stuffing functions into classes and more about
building a system where small, focused parts communicate cleanly.

## Core Ideas in OOP

### Classes and Objects

This is the foundation.

A class defines the shape of something in your program: what data it carries and
what actions it supports. An object is an actual instance of that class.

```text
CLASS Post
    author
    content
    likes = 0

    FUNCTION like()
        likes = likes + 1
END CLASS

post1 = NEW Post(author="alex", content="My first post")
post1.like()
PRINT post1.likes
```

A class tells you what a post is supposed to look like. An object is the specific
post a user created.

### Interfaces

An interface is a contract. It says that anything implementing it must provide
certain methods.

In a social media app, different content types might all be shareable. A post can
be shared, a story can be shared, and a video can be shared. An interface can define
that shared capability without caring about the details of each type.

```text
INTERFACE Shareable
    FUNCTION share(toUser)
    FUNCTION getShareCount()
END INTERFACE
```

Then concrete classes fill in the behavior.

```text
CLASS Post IMPLEMENTS Shareable
    author
    content
    shareCount = 0

    FUNCTION share(toUser)
        shareCount = shareCount + 1
        PRINT author + "'s post was shared to " + toUser

    FUNCTION getShareCount()
        RETURN shareCount
END CLASS

CLASS Story IMPLEMENTS Shareable
    author
    duration
    shareCount = 0

    FUNCTION share(toUser)
        shareCount = shareCount + 1
        PRINT author + "'s story was shared to " + toUser

    FUNCTION getShareCount()
        RETURN shareCount
END CLASS
```

Now you can write code against the interface instead of against one specific class.

```text
FUNCTION shareContent(item, toUser)
    item.share(toUser)
    PRINT "Total shares: " + item.getShareCount()
END FUNCTION

post1 = NEW Post(author="alex", content="Big announcement")
story1 = NEW Story(author="nina", duration=15)

shareContent(post1, "maria")
shareContent(story1, "jamie")
```

The function does not need to care whether `item` is a `Post` or a `Story`. It
only needs to know that `item` satisfies the `Shareable` contract.

There is also a second use for interfaces that people do not always mention.
Sometimes an interface exists only as a label. It has no methods and simply marks
a class as belonging to a category.

```text
INTERFACE Monetizable
    // no methods required
END INTERFACE

CLASS VideoPost IMPLEMENTS Shareable, Monetizable
    ...
END CLASS

CLASS SponsoredStory IMPLEMENTS Shareable, Monetizable
    ...
END CLASS

CLASS RegularPost IMPLEMENTS Shareable
    ...
END CLASS
```

That lets the rest of the system identify which objects belong to that category.

```text
posts = [
    NEW VideoPost(),
    NEW SponsoredStory(),
    NEW RegularPost()
]

monetizableCount = 0

FOR each post IN posts
    IF post IMPLEMENTS Monetizable
        monetizableCount = monetizableCount + 1
    END IF
END FOR

PRINT "Monetizable posts: " + monetizableCount
```

So interfaces can answer two different questions. They can tell you what an object
must be able to do, and they can tell you what kind of thing it is.

### Encapsulation

Encapsulation means keeping related data and behavior together while protecting
important state from random outside changes.

Say you do not want arbitrary code setting a user’s follower count to whatever
it wants.

```text
CLASS User
    username
    PRIVATE followersCount = 0

    FUNCTION gainFollower()
        followersCount = followersCount + 1

    FUNCTION getFollowersCount()
        RETURN followersCount
END CLASS

sam = NEW User(username="sam")
sam.gainFollower()
PRINT sam.getFollowersCount()
```

Without encapsulation, someone could do this:

```text
sam.followersCount = 999999
```

That may seem harmless in a toy example, but in a real system it is exactly how
bad state and hard-to-track bugs creep in. Encapsulation gives the object control
over how its own data changes.

### Inheritance

Inheritance lets one class build on another.

If several types of content share common structure, you can put the shared behavior
in a parent class and let child classes reuse it.

```text
CLASS Content
    author
    text

    FUNCTION publish()
        PRINT author + " published: " + text
END CLASS

CLASS Story EXTENDS Content
    expiresInHours = 24
END CLASS

CLASS Comment EXTENDS Content
    FUNCTION reply()
        PRINT "Reply added to comment"
END CLASS

story1 = NEW Story(author="nina", text="Beach day")
story1.publish()
```

That can be useful, but inheritance is also one of the easiest parts of OOP to
overdo. It is very easy to build deep hierarchies that look tidy on paper and
become awkward in practice.

```text
Content
    → MediaContent
        → TimedMediaContent
            → ShortLivedTimedMediaContent
                → Story
```

At some point, the design starts to feel less like a clean model and more like
a tax code. Small changes in a parent class can ripple outward in ways you did
not intend.

### Composition

Because inheritance can become rigid, many developers prefer composition in a
lot of situations.

A common shorthand is that inheritance models an “is-a” relationship, while
composition models a “has-a” relationship. Instead of saying a `Story` is a deeply
specialized kind of `Content`, you can say a `Story` has behaviors like sharing,
expiring, and commenting.

```text
CLASS ShareBehavior
    FUNCTION share(toUser)
        PRINT "Shared to " + toUser
END CLASS

CLASS ExpireBehavior
    FUNCTION expireAfter24Hours()
        PRINT "This content will expire in 24 hours"
END CLASS

CLASS Story
    author
    text
    shareBehavior = NEW ShareBehavior()
    expireBehavior = NEW ExpireBehavior()

    FUNCTION share(toUser)
        shareBehavior.share(toUser)

    FUNCTION setExpiration()
        expireBehavior.expireAfter24Hours()
END CLASS
```

That tends to produce systems that are easier to adapt because you can mix and
match behavior without forcing everything into one inheritance tree.

As a rule of thumb, inheritance makes sense when there is a natural, stable
parent-child relationship. Composition usually makes more sense when what you
really want is flexibility.

### Polymorphism

Polymorphism means different objects can respond to the same message in different
ways.

For instance, different notification types can all implement `display()`, but
each one can produce a different result.

```text
CLASS Notification
    FUNCTION display()
        PRINT "Generic notification"
END CLASS

CLASS LikeNotification EXTENDS Notification
    FUNCTION display()
        PRINT "Someone liked your post"
END CLASS

CLASS FollowNotification EXTENDS Notification
    FUNCTION display()
        PRINT "Someone followed you"
END CLASS

notifications = [
    NEW LikeNotification(),
    NEW FollowNotification()
]

FOR each item IN notifications
    item.display()
END FOR
```

The caller sends the same message to each object, but the behavior depends on
the object receiving it. That is what gives polymorphism its power.

### Abstraction

Abstraction means exposing the part that matters and hiding the machinery behind
it.

When someone taps “send message” in a social media app, they do not care about
every internal step. They do not need to think about validation, persistence,
permissions, queueing, or notification delivery.

```text
CLASS MessageService
    FUNCTION sendMessage(fromUser, toUser, text)
        SAVE message
        CHECK permissions
        NOTIFY toUser
        PRINT "Message sent"
END CLASS

chat = NEW MessageService()
chat.sendMessage("alex", "maria", "Want to meet later?")
```

The public action is simple. The implementation can be as complicated as it needs
to be. That is abstraction doing its job.

## Why OOP Is Useful

One reason OOP has lasted so long is that it maps reasonably well to how people
already think about systems. Instead of asking only, “what steps happen next,”
you also ask, “what things exist here, what responsibilities do they have, and
how do they interact?”

That shift can make code easier to read, easier to extend, and easier to reason
about over time. It is not magic, and it does not automatically produce good
software, but it gives you a vocabulary for designing systems in manageable pieces.

Just as important, it gives you boundaries. Good software design usually depends
less on clever syntax and more on putting the right responsibilities in the right
places.

## Three Useful Patterns

Design patterns are recurring solutions to recurring problems. They are not laws,
and they are definitely not a substitute for thinking, but they can give you a
solid starting point.

### Singleton

A Singleton means there should only be one instance of something.

In a social media app, that might be useful for global application settings.

```text
CLASS AppSettings
    PRIVATE STATIC instance = NULL
    theme = "dark"

    PRIVATE CONSTRUCTOR()

    STATIC FUNCTION getInstance()
        IF instance == NULL
            instance = CREATE AppSettings()
        END IF
        RETURN instance
END CLASS

settings1 = AppSettings.getInstance()
settings2 = AppSettings.getInstance()

settings1.theme = "light"
PRINT settings2.theme
```

Because both variables refer to the same object, changing one changes the shared
state seen by the other.

### Observer

The Observer pattern fits social media almost perfectly.

When one object changes, other interested objects get notified automatically.
A creator publishes a post, and followers receive updates.

```text
CLASS Creator
    followers = []

    FUNCTION follow(user)
        ADD user TO followers

    FUNCTION publishPost(text)
        PRINT "New post: " + text
        FOR each follower IN followers
            follower.notify(text)
        END FOR
END CLASS

CLASS Follower
    username

    FUNCTION notify(text)
        PRINT username + " got notified: " + text
END CLASS

creator = NEW Creator()
jamie = NEW Follower(username="jamie")
lee = NEW Follower(username="lee")

creator.follow(jamie)
creator.follow(lee)
creator.publishPost("New video is live")
```

This is also another good example of the messaging idea. One event occurs, and
that event propagates outward through messages to other objects.

### Factory

A Factory pattern centralizes object creation.

Instead of sprinkling construction logic everywhere, you ask a factory to create
the right object for you.

```text
CLASS TextPost
    FUNCTION show()
        PRINT "Showing text post"
END CLASS

CLASS ImagePost
    FUNCTION show()
        PRINT "Showing image post"
END CLASS

CLASS VideoPost
    FUNCTION show()
        PRINT "Showing video post"
END CLASS

CLASS PostFactory
    STATIC FUNCTION createPost(type)
        IF type == "text"
            RETURN NEW TextPost()
        ELSE IF type == "image"
            RETURN NEW ImagePost()
        ELSE IF type == "video"
            RETURN NEW VideoPost()
        END IF
    END FUNCTION
END CLASS

postA = PostFactory.createPost("image")
postA.show()
```

That is useful when object creation involves decisions, setup, or branching that
you do not want duplicated across the codebase.

## A Simpler Way to Think About It

If OOP feels overwhelming, strip it back to the essentials.

Your system has things in it. Those things have state. Those things can do things.
Those things send messages to each other. Most of the vocabulary around OOP is
really just a more precise way of talking about those four ideas.

The trouble is that OOP often gets taught as a checklist of terms instead of a
way of modeling a system. Once you see the objects in your program as actors with
responsibilities and boundaries, the terminology starts to make a lot more sense.

## Quick Reference

| Concept             | Meaning                                                  |
| ------------------- | -------------------------------------------------------- |
| Classes and objects | Blueprints and the actual instances created from them    |
| Messaging           | Objects interact by sending requests to each other       |
| Interfaces          | Contracts or labels that define capability or category   |
| Encapsulation       | Keep state controlled and related behavior together      |
| Inheritance         | Reuse shared structure across related types              |
| Composition         | Build objects out of smaller pieces                      |
| Polymorphism        | Same message, different behavior depending on the object |
| Abstraction         | Hide internal complexity behind simple actions           |
| Singleton           | One shared instance                                      |
| Observer            | Notify interested objects when something changes         |
| Factory             | Centralize object creation                               |

At its best, OOP is a practical way to structure software so that complexity
stays local instead of spreading everywhere. And if there is one idea worth holding
onto more than the others, it is this: objects are useful not because they exist,
but because they communicate.
