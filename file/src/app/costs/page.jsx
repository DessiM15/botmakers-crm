import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MasterLayout from '@/masterLayout/MasterLayout';
import CostsPnLPage from '@/components/crm/CostsPnLPage';
import { requireTeam } from '@/lib/auth/helpers';
import {
  getCostEntries,
  getGlobalPnL,
  getMonthlyPnLTrend,
  getCostBreakdownByProvider,
  getClientsForCostDropdown,
  getProjectsForCostDropdown,
} from '@/lib/db/queries/costs';

export const metadata = {
  title: 'Costs & P&L — Botmakers CRM',
};

const Page = async ({ searchParams }) => {
  const cookieStore = await cookies();

  try {
    await requireTeam(cookieStore);
  } catch {
    redirect('/sign-in');
  }

  const sp = await searchParams;
  const page = Number(sp?.page) || 1;
  const search = sp?.search || '';
  const source = sp?.source || 'all';
  const tab = sp?.tab || 'all';

  let costData, pnl, trend, breakdown, clientsList, projectsList;

  try {
    [costData, pnl, trend, breakdown, clientsList, projectsList] = await Promise.all([
      getCostEntries({ search, source, page, perPage: 15 }),
      getGlobalPnL(),
      getMonthlyPnLTrend(),
      getCostBreakdownByProvider(),
      getClientsForCostDropdown(),
      getProjectsForCostDropdown(),
    ]);
  } catch {
    costData = { items: [], total: 0, page: 1, perPage: 15 };
    pnl = { revenue: 0, costs: 0, profit: 0, margin: 0 };
    trend = [];
    breakdown = [];
    clientsList = [];
    projectsList = [];
  }

  return (
    <MasterLayout>
      <CostsPnLPage
        costData={costData}
        pnl={pnl}
        trend={trend}
        breakdown={breakdown}
        clientsList={clientsList}
        projectsList={projectsList}
        initialTab={tab}
        initialSearch={search}
        initialSource={source}
        initialPage={page}
      />
    </MasterLayout>
  );
};

export default Page;
