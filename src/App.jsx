import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import Home from './pages/Home';
import Room from './pages/Room';

function App() {
  const { socket, socketRef, connected } = useSocket();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home socket={socket} connected={connected} />} />
        <Route
          path="/room/:code"
          element={<Room socket={socket} socketRef={socketRef} connected={connected} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
