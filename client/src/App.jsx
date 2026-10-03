import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLocalStorage } from './hooks';
import Landing from './pages/Landing';
import ProfileSetup from './pages/ProfileSetup';
import PracticeRoom from './pages/PracticeRoom';
import Analysis from './pages/Analysis';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const [profileId, setProfileId] = useLocalStorage('friendfit_profile_id', null);
  const [profileData, setProfileData] = useLocalStorage('friendfit_profile', null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <Landing profileId={profileId} />
        } />
        <Route path="/setup" element={
          <ProfileSetup
            onComplete={(profile) => {
              setProfileId(profile.id);
              setProfileData(profile);
            }}
          />
        } />
        <Route path="/practice" element={
          <PracticeRoom
            profileId={profileId}
            profileData={profileData}
          />
        } />
        <Route path="/analysis/:sessionId" element={
          <Analysis profileId={profileId} />
        } />
        <Route path="/dashboard" element={
          <Dashboard
            profileId={profileId}
            profileData={profileData}
            setProfileId={setProfileId}
            setProfileData={setProfileData}
          />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
