'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem } from '@/lib/utils/motion';
import { FilterBar } from '@/components/views/filter-bar';
import { CampaignGrid } from '@/components/views/campaign-grid';
import { CampaignDetailPanel } from '@/components/views/campaign-detail-panel';
import { PeriodicTasksSection } from '@/components/views/periodic-tasks-section';

const COUNTRIES = ['일본', '대만', '중화권', '영미'];

export default function CampaignViewPage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null
  );

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {/* Page Header */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-2xl font-black tracking-tight">
          캠페인 전체 현황, 한눈에 보여줄게.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          각 캠페인의 업무 수행 상태를 매트릭스로 확인하세요. 어디가 비었는지 바로 알 수 있어요.
        </p>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={fadeUpItem}>
        <FilterBar
          date={date}
          onDateChange={setDate}
          countries={COUNTRIES}
          selectedCountry={countryFilter}
          onCountryChange={setCountryFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchText={searchText}
          onSearchChange={setSearchText}
        />
      </motion.div>

      {/* Grid */}
      <motion.div variants={fadeUpItem}>
        <CampaignGrid
          date={date}
          countryFilter={countryFilter}
          searchText={searchText}
          statusFilter={statusFilter}
          onCampaignClick={setSelectedCampaignId}
        />
      </motion.div>

      {/* Periodic Tasks (monthly/once/as_needed) */}
      <motion.div variants={fadeUpItem}>
        <PeriodicTasksSection date={date} />
      </motion.div>

      {/* Detail Panel */}
      <CampaignDetailPanel
        campaignId={selectedCampaignId}
        date={date}
        onClose={() => setSelectedCampaignId(null)}
      />
    </motion.div>
  );
}
