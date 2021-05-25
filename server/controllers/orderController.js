/* eslint-disable no-else-return */
/* eslint-disable no-unreachable */
import asyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Razorpay from "razorpay";
import crypto from "crypto";

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;

  if (orderItems && orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items');
    return;
  } else {
    const order = new Order({
      orderItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice
    });

    const createdOrder = await order.save();

    res.status(201).json(createdOrder);
  }
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (order) {
    res.json(order);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

// @desc    Update order to paid
// @route   GET /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address
    };

    const updatedOrder = await order.save();

    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

const payOrder = asyncHandler(async (req, res) => {
  const { totalPrice } = req.body;
  console.log(totalPrice)
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEYID,
    key_secret: process.env.RAZORPAY_SECRETID
  })

  const rpOrder = await razorpay.orders.create({
    amount: Math.round((totalPrice * 73.25) * 100),
    currency: 'INR'
  })

  if (!rpOrder) {
    res.status(500);
    throw new Error('Internal server error!');
  }

  res.json({ ...rpOrder, ordrId: rpOrder.id });
});

const paymentSuccess = asyncHandler(async (req, res, next) => {
  console.log("SUCCESS CALLED");
  const {
    orderId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature
  } = req.body;

  const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_SECRETID);
  shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const digest = shasum.digest('hex');

  if (!digest) {
    res.status(500);
    throw new Error('Internal server error');
  }

  if (digest !== razorpaySignature)
    return res.status(400).json({ msg: 'Transaction not legit!' });


  const order = await Order.findByIdAndUpdate(orderId, {
    isPaid: true,
    paidAt: Date.now(),
    paymentResult: { id: razorpayPaymentId, status: 'success' }
  });

  console.log(order);


  res.json({
    message: 'success',
    paymentId: razorpayPaymentId
  });

  const updateArr = order.orderItems.map(itm => {
    return {
      updateOne: {
        filter: { _id: itm.product },
        update: { $set: { "countInStock": itm.countInStock - itm.qty } }
      }
    }
  });

  console.log(JSON.stringify(updateArr));

  await Product.bulkWrite([...updateArr]);


});



// @desc    Update order to delivered
// @route   GET /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    order.isDelivered = true;
    order.deliveredAt = Date.now();

    const updatedOrder = await order.save();

    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.json(orders);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name');
  res.json(orders);
});

export { addOrderItems, getOrderById, updateOrderToPaid, updateOrderToDelivered, getMyOrders, getOrders, payOrder, paymentSuccess };
