import { BrowserRouter as Router } from 'react-router-dom';
import Header from './components/Header';
import Routes from './components/Routes';

const App = () => (
  <Router>
    <Header />
    <Routes />
  </Router>
);

export default App;
