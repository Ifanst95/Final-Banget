import React, { useEffect, useMemo, useState } from 'react';
import { useStorage } from './hooks/useStorage';
import { Navbar } from './components/Navbar';
import { AdminLoginModal } from './components/AdminLoginModal';
import { EditSiteConfigModal } from './components/EditSiteConfigModal';
import { CustomMenuSection } from './components/CustomMenuSection';
import { OnlineDatabaseModal } from './components/OnlineDatabaseModal';
import { NoticeBoardSection } from './components/NoticeBoardSection';
import { DashboardSummary } from './components/DashboardSummary';
import { CashReportSection } from './components/CashReportSection';
import { BaksosSection } from './components/BaksosSection';
import { ArrearsSection } from './components/ArrearsSection';
import { ResidentDirectorySection } from './components/ResidentDirectorySection';
import { CommitteesFooter } from './components/CommitteesFooter';
import { INITIAL_NAV_MENUS } from './data/initialData';
import { SiteConfig } from './types';
import { computeOverallKKRecapList } from './utils/helpers';

export default function App() {
  const {
    siteConfig,
    residents,
    transactions,
    baksosAgendas,
    committees,
    announcements,
    calculatedBalances,
    isAdmin,
    loginAdmin,
    logoutAdmin,
    changeAdminPassword,
    updateSiteConfig,
    createPeriod,
    deletePeriod,
    batchImportDues,
    rolloverBillingMonth,
    addResident,
    updateResident,
    deleteResident,
    importResidents,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteTransactions,
    syncHouseDuesEditAndTransactions,
    resetSingleHousePaymentAndSync,
    resetAllDuesPaymentsForPeriod,
    adjustBalance,
    saveAprilInitialBalance,
    saveMayInitialBalance,
    addBaksosAgenda,
    updateBaksosAgenda,
    deleteBaksosAgenda,
    setBaksosAttendance,
    markBaksosFinePaid,
    unmarkBaksosFinePaid,
    addCommittee,
    updateCommittee,
    deleteCommittee,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    resetToDefaultData,
    resetPageToDefaultWithLatestDb,
    lastOnlineSync,
    onlineRevision,
    isOnlineSyncing,
    isOnlineConnected,
    isAutoSyncEnabled,
    toggleAutoSync,
    syncOnlineNow,
    getDatabasePayload,
    restoreFromDatabasePayload,
  } = useStorage();

  const [activeTab, setActiveTab] = useState('pengumuman');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'menus' | 'titles' | 'dues' | 'backup'>('menus');
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  // Permanently enforce bright colorful theme and clear any legacy dark mode classes
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('mandor_theme_v1');
    } catch {}
  }, []);

  // Sembunyikan dan amankan menu rekap keseluruhan dari akses view warga (hanya untuk Pengurus/Admin)
  useEffect(() => {
    if (!isAdmin && activeTab === 'rekap_total_kk') {
      setActiveTab('pengumuman');
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    document.title =
      siteConfig.title ||
      siteConfig.brandName ||
      'Papan Informasi Warga Gang Mandor Blok K2/25 - K3/24';
  }, [siteConfig.title, siteConfig.brandName]);

  // Calculate total unpaid arrears count for navbar badge directly from unified recap
  const arrearsCount = useMemo(() => {
    const { housesWithArrearsCount } = computeOverallKKRecapList(
      residents,
      siteConfig,
      transactions,
      baksosAgendas
    );
    return housesWithArrearsCount;
  }, [residents, siteConfig, transactions, baksosAgendas]);


  const currentNavMenus =
    siteConfig.navigationMenus && siteConfig.navigationMenus.length > 0
      ? siteConfig.navigationMenus
      : INITIAL_NAV_MENUS;

  const customActiveMenu = currentNavMenus.find(
    (m) => m.id === activeTab && m.isCustom
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col font-sans bg-slate-50/90 text-slate-800">

      {/* Top Navbar Header (Colorful & Bright, Dark Mode Removed) */}
      <Navbar
        config={siteConfig}
        isAdmin={isAdmin}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={() => logoutAdmin(true)}
        onOpenConfigModal={() => {
          setConfigModalTab('menus');
          setIsConfigModalOpen(true);
        }}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
        isOnlineSyncing={isOnlineSyncing}
        isOnlineConnected={isOnlineConnected}
        lastOnlineSync={lastOnlineSync}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalArrearsCount={arrearsCount}
      />

      {/* Main Content Area with Adaptive Responsive Layout for Handphone, Tablet & PC */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-6 md:py-7 pb-8 sm:pb-12">
        <div key={activeTab} className="tab-transition-container">
          {activeTab === 'pengumuman' && (
            <NoticeBoardSection
              config={siteConfig}
              residents={residents}
              baksosAgendas={baksosAgendas}
              transactions={transactions}
              balances={calculatedBalances}
              announcements={announcements}
              committees={committees}
              isAdmin={isAdmin}
              onAddAnnouncement={addAnnouncement}
              onEditAnnouncement={updateAnnouncement}
              onDeleteAnnouncement={deleteAnnouncement}
              onNavigateTab={setActiveTab}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardSummary
              config={siteConfig}
              residents={residents}
              isAdmin={isAdmin}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {(activeTab === 'kas' || activeTab === 'iuran_kk' || activeTab === 'rekap_total_kk') && (
            <CashReportSection
              config={siteConfig}
              transactions={transactions}
              residents={residents}
              baksosAgendas={baksosAgendas}
              balances={calculatedBalances}
              isAdmin={isAdmin}
              mode={
                activeTab === 'rekap_total_kk'
                  ? 'rekap_total_kk'
                  : activeTab === 'iuran_kk'
                  ? 'per_kk'
                  : 'mutasi'
              }
              onSwitchMode={(mode) => setActiveTab(mode)}
              onAddTransaction={addTransaction}
              onEditTransaction={updateTransaction}
              onDeleteTransaction={deleteTransaction}
              onDeleteTransactions={deleteTransactions}
              onSyncHouseDuesEditAndTransactions={syncHouseDuesEditAndTransactions}
              onResetSingleHousePaymentAndSync={resetSingleHousePaymentAndSync}
              onResetAllDuesPaymentsForPeriod={resetAllDuesPaymentsForPeriod}
              onAdjustBalance={adjustBalance}
              onUpdateResident={updateResident}
              onMarkFinePaid={markBaksosFinePaid}
              onUnmarkFinePaid={unmarkBaksosFinePaid}
              onSetAttendance={setBaksosAttendance}
              onUpdateBaksosAgenda={updateBaksosAgenda}
              onCreatePeriod={createPeriod}
              onDeletePeriod={deletePeriod}
              onBatchImportDues={batchImportDues}
              onSaveAprilInitialBalance={saveMayInitialBalance}
              onSaveMayInitialBalance={saveMayInitialBalance}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeTab === 'baksos' && (
            <BaksosSection
              config={siteConfig}
              agendas={baksosAgendas}
              residents={residents}
              isAdmin={isAdmin}
              onAddAgenda={addBaksosAgenda}
              onEditAgenda={updateBaksosAgenda}
              onDeleteAgenda={deleteBaksosAgenda}
              onSetAttendance={setBaksosAttendance}
              onMarkFinePaid={markBaksosFinePaid}
              onUnmarkFinePaid={unmarkBaksosFinePaid}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeTab === 'warga' && (
            <ResidentDirectorySection
              config={siteConfig}
              residents={residents}
              isAdmin={isAdmin}
              onAddResident={addResident}
              onUpdateResident={updateResident}
              onDeleteResident={deleteResident}
              onImportResidents={importResidents}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeTab === 'tunggakan' && (
            <ArrearsSection
              config={siteConfig}
              residents={residents}
              baksosAgendas={baksosAgendas}
              transactions={transactions}
              balances={calculatedBalances}
              isAdmin={isAdmin}
              onUpdateResident={updateResident}
              onAddTransaction={addTransaction}
              onMarkFinePaid={markBaksosFinePaid}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {/* Custom Created Menu Section */}
          {customActiveMenu && (
            <CustomMenuSection
              config={siteConfig}
              menu={customActiveMenu}
              isAdmin={isAdmin}
              onOpenManageMenus={() => {
                setConfigModalTab('menus');
                setIsConfigModalOpen(true);
              }}
            />
          )}
        </div>
      </main>

      {/* Public Service Contacts Footer (Hanya tampil di papan pengumuman sesuai permintaan user) */}
      <CommitteesFooter
        config={siteConfig}
        committees={committees}
        isAdmin={isAdmin}
        showContactSection={activeTab === 'pengumuman'}
        onAddCommittee={addCommittee}
        onEditCommittee={updateCommittee}
        onDeleteCommittee={deleteCommittee}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenConfigModal={() => {
          setConfigModalTab('titles');
          setIsConfigModalOpen(true);
        }}
      />

      {/* Discrete Admin Login / Credentials Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={loginAdmin}
        isAdmin={isAdmin}
        onChangePassword={changeAdminPassword}
        onLogoutAndWipe={() => logoutAdmin(true)}
      />

      {/* Website Configuration & Menu Editor Modal (Unified: Menus, Titles, Dues, Backup) */}
      <EditSiteConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={siteConfig}
        onSave={updateSiteConfig}
        initialTab={configModalTab}
        onResetAllData={resetToDefaultData}
        onResetToDefaultWithLatestDb={async () => {
          setActiveTab('pengumuman');
          await resetPageToDefaultWithLatestDb();
        }}
        currentPayload={getDatabasePayload()}
        onRestorePayload={restoreFromDatabasePayload}
      />

      {/* Online Real-Time Auto-Sync & MySQL Relational Database Modal */}
      <OnlineDatabaseModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        currentPayload={getDatabasePayload()}
        onRestorePayload={restoreFromDatabasePayload}
        lastOnlineSync={lastOnlineSync}
        onlineRevision={onlineRevision}
        isOnlineSyncing={isOnlineSyncing}
        isOnlineConnected={isOnlineConnected}
        isAutoSyncEnabled={isAutoSyncEnabled}
        onToggleAutoSync={toggleAutoSync}
        onSyncOnlineNow={syncOnlineNow}
      />
    </div>
  );
}
