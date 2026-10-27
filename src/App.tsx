import React, { useEffect, useState } from 'react';
import { useStorage } from './hooks/useStorage';
import { Navbar } from './components/Navbar';
import { AdminLoginModal } from './components/AdminLoginModal';
import { EditSiteConfigModal } from './components/EditSiteConfigModal';
import { ManageMenusModal } from './components/ManageMenusModal';
import { CustomMenuSection } from './components/CustomMenuSection';
import { OnlineDatabaseModal } from './components/OnlineDatabaseModal';
import { NoticeBoardSection } from './components/NoticeBoardSection';
import { DashboardSummary } from './components/DashboardSummary';
import { CashReportSection } from './components/CashReportSection';
import { BaksosSection } from './components/BaksosSection';
import { ArrearsSection } from './components/ArrearsSection';
import { ResidentDirectorySection } from './components/ResidentDirectorySection';
import { FinancialBillingSection } from './components/FinancialBillingSection';
import { CommitteesFooter } from './components/CommitteesFooter';
import { INITIAL_NAV_MENUS } from './data/initialData';
import { SiteConfig } from './types';

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
    adjustBalance,
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
  const [isManageMenusModalOpen, setIsManageMenusModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  // Permanently enforce bright colorful theme and clear any legacy dark mode classes
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('mandor_theme_v1');
    } catch {}
  }, []);

  useEffect(() => {
    document.title =
      siteConfig.title ||
      siteConfig.brandName ||
      'Papan Informasi Warga Gang Mandor Blok K2/25 - K3/24';
  }, [siteConfig.title, siteConfig.brandName]);

  // Calculate total unpaid arrears count for navbar badge (empty houses excluded from routine dues)
  const arrearsCount = residents.filter((house) => {
    const hasDuesDebt = house.occupancy !== 'Kosong' && house.duesStatus === 'Belum Bayar';
    const hasBaksosDebt = baksosAgendas.some(
      (a) => a.attendance?.[house.id] === 'Tidak Hadir' && !a.finesPaid?.[house.id]
    );
    const hasPrevDebt = (house.previousArrears || 0) > 0;
    return hasDuesDebt || hasBaksosDebt || hasPrevDebt;
  }).length;

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
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenManageMenusModal={() => setIsManageMenusModalOpen(true)}
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

          {(activeTab === 'kas' || activeTab === 'iuran_kk') && (
            <CashReportSection
              config={siteConfig}
              transactions={transactions}
              residents={residents}
              baksosAgendas={baksosAgendas}
              balances={calculatedBalances}
              isAdmin={isAdmin}
              mode={activeTab === 'iuran_kk' ? 'per_kk' : 'mutasi'}
              onSwitchMode={(mode) => setActiveTab(mode)}
              onAddTransaction={addTransaction}
              onEditTransaction={updateTransaction}
              onDeleteTransaction={deleteTransaction}
              onAdjustBalance={adjustBalance}
              onUpdateResident={updateResident}
              onCreatePeriod={createPeriod}
              onDeletePeriod={deletePeriod}
              onBatchImportDues={batchImportDues}
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

          {activeTab === 'penarikan' && (
            <FinancialBillingSection
              config={siteConfig}
              residents={residents}
              baksosAgendas={baksosAgendas}
              transactions={transactions}
              isAdmin={isAdmin}
              onUpdateResident={updateResident}
              onDeleteResident={deleteResident}
              onAddTransaction={addTransaction}
              onDeleteTransaction={deleteTransaction}
              onMarkFinePaid={markBaksosFinePaid}
              onUnmarkFinePaid={unmarkBaksosFinePaid}
              onBatchImportDues={batchImportDues}
              onCreatePeriod={createPeriod}
              onRolloverBillingMonth={rolloverBillingMonth}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* Custom Created Menu Section */}
          {customActiveMenu && (
            <CustomMenuSection
              config={siteConfig}
              menu={customActiveMenu}
              isAdmin={isAdmin}
              onOpenManageMenus={() => setIsManageMenusModalOpen(true)}
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
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
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

      {/* Website Configuration & Description Editor Modal */}
      <EditSiteConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={siteConfig}
        onSave={updateSiteConfig}
        onOpenManageMenus={() => setIsManageMenusModalOpen(true)}
        onResetAllData={resetToDefaultData}
        onResetToDefaultWithLatestDb={async () => {
          setActiveTab('pengumuman');
          await resetPageToDefaultWithLatestDb();
        }}
        currentPayload={getDatabasePayload()}
        onRestorePayload={restoreFromDatabasePayload}
      />

      {/* Dedicated Menu & Sub-Menu Management Modal for Admin */}
      <ManageMenusModal
        isOpen={isManageMenusModalOpen}
        onClose={() => setIsManageMenusModalOpen(false)}
        config={siteConfig}
        onSaveMenus={(newMenus) => {
          const updates: Partial<SiteConfig> = { navigationMenus: newMenus };
          // Keep existing section titles in sync if built-in menus were edited
          const pengumumanMenu = newMenus.find((m) => m.id === 'pengumuman');
          if (pengumumanMenu) {
            updates.announcementSectionTitle = pengumumanMenu.title;
            updates.announcementSectionSubtitle = pengumumanMenu.description;
          }
          const dashboardMenu = newMenus.find((m) => m.id === 'dashboard');
          if (dashboardMenu) {
            updates.dashboardSectionTitle = dashboardMenu.title;
            updates.dashboardSectionDescription = dashboardMenu.description;
          }
          const kasMenu = newMenus.find((m) => m.id === 'kas');
          if (kasMenu) {
            updates.cashSectionTitle = kasMenu.title;
            updates.cashDescription = kasMenu.description;
          }
          const baksosMenu = newMenus.find((m) => m.id === 'baksos');
          if (baksosMenu) {
            updates.baksosSectionTitle = baksosMenu.title;
            updates.baksosDescription = baksosMenu.description;
          }
          const wargaMenu = newMenus.find((m) => m.id === 'warga');
          if (wargaMenu) {
            updates.directorySectionTitle = wargaMenu.title;
            updates.directorySectionDescription = wargaMenu.description;
          }
          const tunggakanMenu = newMenus.find((m) => m.id === 'tunggakan');
          if (tunggakanMenu) {
            updates.arrearsSectionTitle = tunggakanMenu.title;
            updates.arrearsSectionDescription = tunggakanMenu.description;
          }
          updateSiteConfig(updates);
        }}
        onResetMenusToDefault={() => {
          updateSiteConfig({ navigationMenus: INITIAL_NAV_MENUS });
        }}
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
