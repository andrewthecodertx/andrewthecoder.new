---
title: 'C Hash Tables and 2-Bit Bookkeeping'
slug: 'hash-tables-and-2-bit-bookkeeping'
publishDate: '2025-08-01'
description: "A look into hash tables, using a C implementation as an example, and an explanation of the memory-saving '2-bit bookkeeping' technique."
categories: ['Software Development']
tags: ['c', 'c++', 'data structures', 'hash table']
author: Andrew
comments_enabled: true
featured: true
github: 'https://github.com/andrewthecodertx/c-hashtable'
image: '/assets/blog/hashtables.webp'
---

It's a common debate among programmers: is C still a good choice for building
modern, high-performance data structures? Some argue that newer languages like
C++ make it easier, with more built-in tools and abstractions. This project, a
generic hash table in C, takes on that challenge to show what's possible with a
bit of clever engineering.

The result is a hash table that is not only fast and flexible but also
incredibly memory-efficient, thanks to a simple but powerful technique: 2-bit
bookkeeping.

## Core Features

This hash table was built with a few key goals in mind:

- **Works with Any Data Type**: You can use it to store anything you want, from
  simple numbers to complex data structures.
- **Fast and Efficient**: It uses a technique called "open addressing," which
  is quick and friendly to your computer's memory.
- **Smart Memory Use**: All data is stored in a single, organized block of
  memory, which improves performance.
- **Use Your Own Memory Manager**: If you have a special way of managing memory,
  you can plug it right in.
- **Extremely Low Memory Overhead**: This is the star of the show. We use a
  special trick to keep track of our data using only **2 bits of memory per
  entry**.

## How It Works

The hash table's internal workings are hidden from the user, who interacts with
it through a simple set of functions. Here's a peek under the hood:

```c
// This is the internal structure of our hash table.
struct HashTable {
    // Handlers for managing different data types.
    type_handler   key_handler;
    type_handler   value_handler;
    // Custom memory management functions.
    allocator      alloc_handler;
    // The total number of slots available.
    size_t         capacity;
    // The number of items currently in the table.
    size_t         count;
    // A special array to keep track of each slot's status.
    uint8_t*       control_bytes;
    // The array where we store the actual data.
    struct InternalEntry *entries;
};

// This is what a single entry in the hash table looks like.
struct InternalEntry {
    void* key;
    void* value;
};
```

The `entries` array holds the data you store, while the `control_bytes` array
is where the memory-saving magic happens.

### The Hotel Analogy: 2-Bit Bookkeeping

To save memory, we use a clever trick to keep track of the status of each slot
in the hash table. Think of it like a hotel with a very efficient receptionist.
Instead of using a big, clunky notebook to track room status, the receptionist
uses a compact system where each room's status is represented by a tiny 2-bit
code:

```c
// We use 2 bits to represent the state of each slot.
// 00: Empty (the slot has never been used)
// 01: Occupied (the slot is currently in use)
// 10: Deleted (the slot used to have data, but it was deleted)
#define STATE_EMPTY    0b00
#define STATE_OCCUPIED 0b01
#define STATE_DELETED  0b10
```

This means we use only a quarter of the memory that would be required if we
stored a full byte for each slot's status. The `get_state` and `set_state`
functions handle the bit manipulation to read and write these states:

```c
// This function gets the status of a slot at a given index.
static uint8_t get_state(const HashTable* table, size_t index) {
    // Find the right byte in our control array.
    size_t byte_index = index / 4;
    // Find the position of the 2 bits within that byte.
    size_t bit_offset = (index % 4) * 2;
    // Read the 2 bits to get the state.
    return (table->control_bytes[byte_index] >> bit_offset) & 0b11;
}

// This function sets the status of a slot at a given index.
static void set_state(HashTable* table, size_t index, uint8_t state) {
    // Find the right byte in our control array.
    size_t byte_index = index / 4;
    // Find the position of the 2 bits within that byte.
    size_t bit_offset = (index % 4) * 2;
    // Clear the 2 bits for the current slot.
    table->control_bytes[byte_index] &= ~((uint8_t)0b11 << bit_offset);
    // Set the new state.
    table->control_bytes[byte_index] |= (state & 0b11) << bit_offset;
}
```

This technique is a great example of the low-level control C gives you,
allowing for significant memory savings.

### Handling Different Data Types

To make the hash table work with any kind of data, you provide a set of simple
instructions called "type handlers." These tell the hash table how to manage
your specific data.

```c
// This structure holds the functions for managing a data type.
typedef struct {
    copy_function    copy;    // How to copy your data
    destroy_function destroy; // How to delete your data
    key_equal_function equal;   // How to check if two keys are equal
    hash_function    hash;    // How to create a unique ID for a key
} type_handler;
```

This gives you complete control over how your data is handled, which is one of
the benefits of C's hands-on approach.

### Custom Memory Management

For projects with special memory needs, you can also provide your own memory
manager.

```c
// This structure holds your custom memory functions.
typedef struct {
    alloc_function alloc; // Your function for allocating memory
    free_function  free;  // Your function for freeing memory
} allocator;
```

This is like telling the hash table to use a specific supplier for its
resources, giving you more control over how memory is managed. If you don't
provide a custom manager, it will use the standard C library functions.

## Building and Running the Demo

A `Makefile` is provided to build the example program.

```bash
# Build the demo
make

# Run the demo
./hashtable_demo

# Clean up build files
make clean
```

The demo in `main.c` shows how to create, insert, lookup, update, and delete
entries using a custom struct as the key type.

## Conclusion

This project demonstrates that C is still a powerful tool for creating
high-performance data structures. While it may require more manual effort than
some newer languages, C gives you the control to optimize for speed and memory
in ways that are hard to achieve otherwise. The 2-bit bookkeeping trick is a
perfect example of how a little cleverness can lead to big efficiency gains.
