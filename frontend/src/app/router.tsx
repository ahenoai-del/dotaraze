import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/layout';
import { DashboardPage } from '../pages/dashboard';
import { PrivacyPage } from '../pages/privacy';
import { MetaLabPage } from '../pages/meta-lab';
import { MatchDetailPage } from '../pages/match-detail';

export function App() {
  return <BrowserRouter><Layout><Routes><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/matches/:matchId" element={<MatchDetailPage/>}/><Route path="/meta" element={<MetaLabPage/>}/><Route path="/privacy" element={<PrivacyPage/>}/><Route path="*" element={<main className="page-content legal-page"><h1>Страница не найдена</h1><Link to="/dashboard">Вернуться к Dashboard</Link></main>}/></Routes></Layout></BrowserRouter>;
}
