import { useState, useEffect } from 'react';
import axios from 'axios';
import { PayPalButton } from 'react-paypal-button-v2';
import { Link } from 'react-router-dom';
import { Row, Col, ListGroup, Image, Card, Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import { getOrderDetails, payOrder, deliverOrder } from '../../store/actions/orderActions';
import { ORDER_PAY_RESET, ORDER_DELIVER_RESET } from '../../store/constants/orderConstants';

const OrderScreen = ({ match, history }) => {
  const [loadingPay, setLoadingpay] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const { order, loading, error } = useSelector((state) => state.orderDetails);
  const dispatch = useDispatch();
  const { success: successPay } = useSelector((state) => state.orderPay);
  const cart = useSelector((state) => state.cart);
  const { loading: loadingDeliver, success: successDeliver } = useSelector((state) => state.orderDeliver);
  const { userInfo } = useSelector((state) => state.userLogin);
  const orderId = match.params.id;

  if (!loading) {
    //   Calculate prices
    const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2);
    order.itemsPrice = addDecimals(order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0));
  }

  useEffect(() => {
    if (!userInfo) {
      history.push('/login');
    }

    if (!order || successPay || successDeliver || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET });
      dispatch({ type: ORDER_DELIVER_RESET });
      dispatch(getOrderDetails(orderId));
    }
  }, [dispatch, orderId, successPay, successDeliver, order, history, userInfo]);

  const deliverHandler = () => {
    dispatch(deliverOrder(order));
  };

  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  const toggleLoadingPay = () => {
    setLoadingpay((lp) => !lp);
  };

  const successPaymentHandler = (paymentResult) => {
    console.log(paymentResult);
    dispatch(payOrder(orderId, paymentResult));
  };

  const payNow = async () => {
    toggleLoadingPay();
    try {
      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');

      if (!res) {
        alert('Razorpay SDK failed to load. Are you online?');
        toggleLoadingPay();
        return;
      }
      // creating a new order
      console.log(cart);
      const result = await axios.post(`/api/orders/payorder`, {
        totalPrice: cart.cartItems.reduce((acc, item) => acc + item.price * item.qty, 0)
      });

      if (!result) {
        alert('Server error. Are you online?');
        toggleLoadingPay();
        return;
      }
      // Getting the order details back
      const { amount, ordrId, currency } = result.data;

      const options = {
        key: process.env.RAZORPAY_ID,
        amount: amount.toString(),
        currency,
        name: 'My Shop',
        description: 'Order Payment',
        order_id: ordrId,
        handler: async (response) => {
          try {
            const data = {
              orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature
            };

            const resp = await axios.post('/api/orders/payment/success', data);
            const { message } = resp.data;
            if (message === 'success') {
              successPaymentHandler(message);
            } else {
              toggleLoadingPay();
              alert(message);
            }
          } catch (err) {
            console.log(err);
            toggleLoadingPay();
          }
        },
        modal: {
          ondismiss: toggleLoadingPay
        },
        prefill: {
          email: userInfo.email,
          name: userInfo.name
        },
        theme: {
          color: '#8739f9'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.log(err);
    }
  };

  return !loading ? (
    !error ? (
      <>
        <h1>Order No: {order._id}</h1>
        <Row>
          <Col md={8}>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <h2>Shipping</h2>
                <p>
                  <strong>Name: </strong> {order.user.name}
                </p>
                <p>
                  <strong>Email: </strong> <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
                </p>
                <p>
                  <strong>Address:</strong>
                  {order.shippingAddress.address}, {order.shippingAddress.city} {order.shippingAddress.postalCode},{' '}
                  {order.shippingAddress.country}
                </p>

                {order.isDelivered ? (
                  <Message variant="success">Delivered on {order.deliveredAt}</Message>
                ) : (
                  <Message variant="danger">Not Delivered</Message>
                )}
              </ListGroup.Item>

              <ListGroup.Item>
                <h2>Payment Method</h2>
                <p>
                  <strong>Method: </strong>
                  {order.paymentMethod}
                </p>

                {order.isPaid ? (
                  <Message variant="success">Paid on {order.paidAt}</Message>
                ) : (
                  <Message variant="danger">Not Paid</Message>
                )}
              </ListGroup.Item>

              <ListGroup.Item>
                <h2>Order Items</h2>
                {order.orderItems.length !== 0 ? (
                  <ListGroup variant="flush">
                    {order.orderItems.map(({ image, name, product, qty, price }, index) => (
                      <ListGroup.Item key={index}>
                        <Row>
                          <Col md={1}>
                            <Image src={image} alt={name} fluid rounded />
                          </Col>

                          <Col>
                            <Link to={`/product/${product}`}>{name}</Link>
                          </Col>

                          <Col md={4}>
                            {qty} x ${price} = ${qty * price}
                          </Col>
                        </Row>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <Message>Order is empty</Message>
                )}
              </ListGroup.Item>
            </ListGroup>
          </Col>

          <Col md={4}>
            <Card>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <h2>Order Summary</h2>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>Items</Col>
                    <Col>${order.itemsPrice}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>Shipping</Col>
                    <Col>${order.shippingPrice}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>Tax</Col>
                    <Col>${order.taxPrice}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>Total</Col>
                    <Col>${order.totalPrice}</Col>
                  </Row>
                </ListGroup.Item>

                {!order.isPaid && (
                  <ListGroup.Item>
                    <Button className="btn-block" onClick={payNow}>
                      {loadingPay ? <Loader /> : 'Pay now'}
                    </Button>
                  </ListGroup.Item>
                )}

                {loadingDeliver && <Loader />}
                {userInfo && userInfo.isAdmin && order.isPaid && !order.isDelivered && (
                  <ListGroup.Item>
                    <Button type="button" className="btn btn-block" onClick={deliverHandler}>
                      Mark As Delivered
                    </Button>
                  </ListGroup.Item>
                )}
              </ListGroup>
            </Card>
          </Col>
        </Row>
      </>
    ) : (
      <Message variant="danger">{error}</Message>
    )
  ) : (
    <Loader />
  );
};

export default OrderScreen;
