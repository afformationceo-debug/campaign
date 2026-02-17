'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { FilterBar } from '@/components/views/filter-bar';
import { CampaignGrid } from '@/components/views/campaign-grid';
import { CampaignDetailPanel } from '@/components/views/campaign-detail-panel';

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
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          캠페인별 전체 행위 체크
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          모든 캠페인의 업무 수행 현황을 매트릭스 형태로 확인할 수 있습니다.
        </p>
      </div>

      {/* Filter Bar */}
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

      {/* Grid */}
      <CampaignGrid
        date={date}
        countryFilter={countryFilter}
        searchText={searchText}
        statusFilter={statusFilter}
        onCampaignClick={setSelectedCampaignId}
      />

      {/* Detail Panel */}
      <CampaignDetailPanel
        campaignId={selectedCampaignId}
        date={date}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
  );
}
