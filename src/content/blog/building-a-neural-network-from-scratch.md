---
title: 'Go Neural Network Implementation'
slug: building-a-neural-network-from-scratch
publishDate: '2025-09-10'
description: 'A feed-forward neural network implementation in Go with support for multiple activation functions, model persistence, and an interactive TUI.'
categories: ['Software Development']
tags: ['neural network', 'machine learning', 'go']
author: Andrew
comments_enabled: true
featured: true
github: 'https://github.com/andrewthecodertx/go-neural-network'
image: '/assets/blog/neuralnetwork.webp'
---

This project implements a feed-forward neural network in Go with a configurable
architecture, multiple activation functions, and model persistence. It includes
a terminal user interface (TUI) for training and prediction.

## Architecture

The network is a feed-forward neural network where information flows in one
direction: from the input layer, through configurable hidden layers, to the
output layer.

Network structure:

```go
// internal/neuralnetwork/neural_network.go

type NeuralNetwork struct {
  NumInputs             int           `json:"numInputs"`
  HiddenLayers          []int         `json:"hiddenLayers"`
  NumOutputs            int           `json:"numOutputs"`
  HiddenWeights         [][][]float64 `json:"hiddenWeights"`
  OutputWeights         [][]float64   `json:"outputWeights"`
  HiddenBiases          [][]float64   `json:"hiddenBiases"`
  OutputBiases          []float64     `json:"outputBiases"`
  HiddenActivations     []string      `json:"hiddenActivations"`
  OutputActivation      string        `json:"outputActivation"`
 // ...
}
```

The struct stores the network configuration, including input/output dimensions,
hidden layer sizes, weights, biases, and activation functions for each layer.

## Forward Propagation

Forward propagation computes the output by passing input data through the
network. For each neuron:

$output = f(\sum_{i=1}^{n} (input_i \cdot weight_i) + bias)$

Where `f` is the activation function.

### Supported Activation Functions

- **ReLU:** $f(x) = \max(0, x)$
- **Sigmoid:** $f(x) = \frac{1}{1 + e^{-x}}$
- **Tanh:** $f(x) = \tanh(x)$
- **Linear:** $f(x) = x$

Implementation:

```go
// internal/neuralnetwork/neural_network.go

func (nn *NeuralNetwork) FeedForward(inputs []float64) ([][]float64, []float64) {
 // ...
 // Calculate hidden layer outputs
 for i, layerSize := range nn.HiddenLayers {
  // ...
  for j := range hiddenOutputs[i] {
   sum := 0.0
   for k, val := range layerInput {
    sum += val * nn.HiddenWeights[i][j][k]
   }
   hiddenOutputs[i][j] = nn.hiddenActivationFuncs[i].Activate(sum + nn.HiddenBiases[i][j])
  }
  layerInput = hiddenOutputs[i]
 }
 // ...
 return hiddenOutputs, finalOutputs
}
```

## Training: Backpropagation

The network trains using backpropagation and gradient descent:

1. Forward pass to compute predictions
2. Calculate error (loss) between predictions and targets
3. Propagate error backward through the network
4. Compute gradients for each weight and bias
5. Update weights and biases using gradient descent

Implementation:

```go
// internal/neuralnetwork/neural_network.go

func (nn *NeuralNetwork) Backpropagate(inputs []float64, targets []float64,
  hiddenOutputs [][]float64, finalOutputs []float64, learningRate float64) {
 // Calculate output layer errors and deltas
 // ...
 // Calculate hidden layer errors and deltas
 // ...
 // Update output weights and biases
 // ...
 // Update hidden weights and biases
 // ...
}
```

## Features

### Modular Design

Code is organized into separate packages:

- `cli` - Terminal user interface
- `data` - Dataset loading and preprocessing
- `neuralnetwork` - Core network implementation
- `utils` - Helper functions

### Model Persistence

Trained models can be saved to and loaded from JSON files in the `saved_models/`
directory. This allows for model reuse without retraining.

### Terminal User Interface

Full-screen TUI for:

- Training new models with configurable architecture
- Loading saved models
- Making predictions
- Live training progress visualization

### Weight Initialization

Weights are initialized using He initialization, which helps with training deep
networks using ReLU activations.

### Training Configuration

- Configurable number of hidden layers and neurons per layer
- Per-layer activation function selection
- Adjustable learning rate and epochs
- Error goal threshold for early stopping
- Automatic train/test split

## Included Datasets

Sample datasets are provided:

- **Iris dataset** - Species classification based on flower measurements
- **Red Wine Quality dataset** - Wine quality prediction from physicochemical properties

Both datasets are from the UCI Machine Learning Repository.

## Usage

Run the application:

```bash
go run .
```

Or with Docker:

```bash
docker build -t go-neuralnetwork .
docker run -it --rm go-neuralnetwork
```

Navigate the TUI using arrow keys and Enter. Press `q` or `Ctrl+C` to quit.

## Contribution and Collaboration

This project is open for contributions and collaboration. Areas of interest include:

- Implementing additional optimization algorithms (Adam, RMSprop)
- Adding regularization support (L1/L2)
- Expanding the test suite
- Performance optimizations
- Additional activation functions
- Convolutional or recurrent network architectures

Feel free to open issues for bugs or feature requests, or submit pull requests
with improvements. Collaboration on new features or research directions is welcome.
