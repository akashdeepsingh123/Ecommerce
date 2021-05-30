import { Spinner } from 'react-bootstrap';

const Loader = () => (
  <Spinner
    animation="border"
    role="status"
    style={{
      width: '30px',
      height: '30px',
      margin: 'auto',
      display: 'block'
    }}
  >
    <span className="sr-only">Loading...</span>
  </Spinner>
);

export default Loader;
