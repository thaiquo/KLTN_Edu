import { expect, test } from '@playwright/test';

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true };

async function mockPortal(page, options = {}) {
  const state = { role: options.role || 'STAFF', duty: options.duty || 'ON_DUTY', authenticated: true, contractAvailable: options.contractAvailable !== false };
  let releaseAnalytics;
  const analyticsGate = new Promise(resolve => { releaseAnalytics = resolve; });
  state.releaseAnalytics = releaseAnalytics;
  await page.route('http://127.0.0.1:15173/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    if (path === '/api/users/me') {
      if (!state.authenticated) return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      return route.fulfill({ json: {
        id: 9001, email: 'm3.acceptance@local.test', fullName: 'M3 Acceptance',
        roles: [state.role], activeRole: state.role
      } });
    }
    if (path === '/api/auth/logout') {
      state.authenticated = false;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/tutor-applications/me') {
      return route.fulfill({ json: {
        id: 7001,
        userId: 9001,
        status: state.role === 'TUTOR' ? 'APPROVED' : 'DRAFT'
      } });
    }
    if (path === '/api/tutor-statistics/v1') {
      if (options.statisticsDelayMs) {
        await new Promise(resolve => setTimeout(resolve, options.statisticsDelayMs));
      }
      if (options.emptyStatistics) {
        return route.fulfill({ json: {
          generatedAt: '2026-11-18T10:00:00Z', rangeDays: 30,
          learning: { status: 'SUCCESS', errorCode: null, data: {
            teaching: { activeClasses: 0, completedClasses: null, upcomingClasses: 0, totalStudents: 0, totalSessions: 0, completedSessions: 0, upcomingSessionCount: 0, cancelledSessions: 0 },
            operations: { assignmentsCreated: 0, submittedAssignments: 0, pendingSubmissions: 0, gradedSubmissions: 0, sessionActionsPending: 0 },
            reviews: { averageRating: 0, reviewCount: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recent: [] },
            classes: [], upcomingSessions: []
          } },
          income: { status: 'SUCCESS', errorCode: null, data: {
            currency: 'USDC', totalEarned: 0, releasedAmount: 0, pendingAmount: 0,
            settledPayouts: 0, pendingPayouts: 0, classBreakdown: []
          } },
          sources: [{ source: 'LEARNING', status: 'SUCCESS' }, { source: 'CONTRACT', status: 'SUCCESS' }]
        } });
      }
      return route.fulfill({ json: {
        generatedAt: '2026-11-18T10:00:00Z', rangeDays: 30,
        learning: { status: 'SUCCESS', errorCode: null, data: {
          teaching: { activeClasses: 2, completedClasses: null, upcomingClasses: 1, totalStudents: 7, totalSessions: 18, completedSessions: 10, upcomingSessionCount: 6, cancelledSessions: 2 },
          operations: { assignmentsCreated: 8, submittedAssignments: 12, pendingSubmissions: 3, gradedSubmissions: 9, sessionActionsPending: 1 },
          reviews: { averageRating: 4.8, reviewCount: 5, distribution: { 5: 4, 4: 1, 3: 0, 2: 0, 1: 0 }, recent: [{ id: 1, classRoomId: 42, rating: 5, comment: 'Gia sư hướng dẫn rõ ràng và tận tâm.' }] },
          classes: [{ classRoomId: 42, className: 'Toán 11 nâng cao', status: 'ACTIVE', enrolledStudents: 4, totalSessions: 12, completedSessions: 8, upcomingSessions: 4 }],
          upcomingSessions: [{ sessionId: 401, classRoomId: 42, className: 'Toán 11 nâng cao', sequenceNumber: 9, topic: 'Hàm số', sessionDate: '2026-11-20', startTime: '19:00', endTime: '20:30' }]
        } },
        income: state.contractAvailable ? { status: 'SUCCESS', errorCode: null, data: {
          currency: 'USDC', totalEarned: 25.6, releasedAmount: 25.6, pendingAmount: 4.25, settledPayouts: 4, pendingPayouts: 1,
          classBreakdown: [{ classRoomId: 42, className: 'Toán 11 nâng cao', releasedAmount: 25.6, pendingAmount: 4.25, settledPayouts: 4 }]
        } } : { status: 'UNAVAILABLE', errorCode: 'HTTP_503', data: null },
        sources: [
          { source: 'LEARNING', status: 'SUCCESS' },
          { source: 'CONTRACT', status: state.contractAvailable ? 'SUCCESS' : 'UNAVAILABLE', errorCode: state.contractAvailable ? null : 'HTTP_503' }
        ]
      } });
    }
    if (path.endsWith('/staff/duty/status')) {
      const onDuty = state.duty === 'ON_DUTY';
      return route.fulfill({ json: {
        status: state.duty, enforcementEnabled: true, writeAllowed: onDuty,
        canStart: false, assignment: null
      } });
    }
    if (path === '/api/operational-work-items/v1/summary') {
      return route.fulfill({ json: {
        normal: 0, dueSoon: 1, overdue: 1, notApplicable: 0, truncated: false,
        bySource: { SUPPORT_TICKET: 2 },
        sources: [{ source: 'SUPPORT_TICKET', status: 'SUCCESS' }]
      } });
    }
    if (path === '/api/operational-work-items/v1') {
      return route.fulfill({ json: {
        ...emptyPage,
        content: [
          {
            source: 'SUPPORT_TICKET', resourceId: 'ticket-shared', title: 'Ticket hàng đợi chung',
            status: 'OPEN', priority: 'HIGH', assignee: null, claimable: true,
            createdAt: '2026-11-18T08:00:00Z', dueAt: '2026-11-18T09:00:00Z',
            slaState: 'OVERDUE', overdueByMinutes: 15
          },
          {
            source: 'SUPPORT_TICKET', resourceId: 'ticket-assigned', title: 'Ticket đã phân công',
            status: 'ASSIGNED', priority: 'MEDIUM', assignee: 'staff.one@local.test', claimable: false,
            createdAt: '2026-11-18T08:30:00Z', dueAt: '2026-11-18T10:00:00Z',
            slaState: 'DUE_SOON', remainingMinutes: 20
          }
        ],
        totalElements: 2, numberOfElements: 2, empty: false,
        contractVersion: 'V1', sourceTotals: { SUPPORT_TICKET: 2 },
        sources: [
          { source: 'COMMUNITY_MODERATION', status: 'SUCCESS' },
          { source: 'SUPPORT_TICKET', status: 'SUCCESS' }
        ]
      } });
    }
    if (path === '/api/operations/dashboard/v1') {
      const rangeDays = Number(requestUrl.searchParams.get('rangeDays') || 30);
      if (options.analyticsPending) await analyticsGate;
      if (options.analyticsDelayMs) await new Promise(resolve => setTimeout(resolve, options.analyticsDelayMs));
      return route.fulfill({ json: {
        generatedAt: '2026-11-18T09:00:00Z', rangeDays,
        operational: { status: 'SUCCESS', errorCode: null, data: {
          contractVersion: 'V1', partial: false, truncated: false, unavailableSources: [],
          workItemsBySource: options.emptyAnalytics ? [
            { source: 'TUTOR_APPLICATION', openCount: 0, status: 'SUCCESS' },
            { source: 'SUPPORT_TICKET', openCount: 0, status: 'SUCCESS' }
          ] : [
            { source: 'TUTOR_APPLICATION', openCount: 3, status: 'SUCCESS' },
            { source: 'TEACHING_REGISTRATION', openCount: 2, status: 'SUCCESS' },
            { source: 'CLASS_APPROVAL', openCount: 1, status: 'SUCCESS' },
            { source: 'COMMUNITY_MODERATION', openCount: 4, status: 'SUCCESS' },
            { source: 'SUPPORT_TICKET', openCount: 2, status: 'SUCCESS' },
            { source: 'DISPUTE', openCount: 1, status: 'SUCCESS' },
            { source: 'TERMINATION', openCount: 1, status: 'SUCCESS' }
          ],
          sla: options.emptyAnalytics ? { normal: 0, dueSoon: 0, overdue: 0, notApplicable: 0, truncated: false } : { normal: 8, dueSoon: 4, overdue: 2, notApplicable: 0, truncated: false },
          staffWorkload: options.emptyAnalytics ? [] : [{ assignee: 'staff.one@local.test', assigned: 6, normal: 3, dueSoon: 2, overdue: 1, notApplicable: 0 }]
        } },
        financial: state.contractAvailable ? { status: 'SUCCESS', errorCode: null, data: {
          generatedAt: '2026-11-18T09:00:00Z', rangeDays, bucket: rangeDays === 30 ? 'day' : 'week',
          series: [{ currency: 'USDC', currencyDecimals: 6,
            totals: { releasedAmount: 21.76, pendingAmount: 6.4, refundAmount: 3.84, contractValue: 64, settlementCount: 4, contractCount: 2 },
            points: options.emptyAnalytics ? [] : [
              { period: '2026-11-10', releasedAmount: 8.16, pendingAmount: 6.4, refundAmount: 0, contractValue: 32, settlementCount: 2, contractCount: 1 },
              { period: '2026-11-17', releasedAmount: 13.6, pendingAmount: 0, refundAmount: 3.84, contractValue: 32, settlementCount: 2, contractCount: 1 }
            ]
          }]
        } } : { status: 'UNAVAILABLE', errorCode: 'HTTP_503', data: null }
      } });
    }
    if (path === '/api/operations/health/v1') {
      return route.fulfill({ json: {
        generatedAt: '2026-11-18T09:00:00Z',
        operational: {
          sources: [
            { source: 'ACCOUNT_SUPPORT', status: 'SUCCESS', latencyMs: 18, itemCount: 2, lastSuccessfulRefresh: '2026-11-18T09:00:00Z' },
            { source: 'CONTRACT_DISPUTE', status: 'UNAVAILABLE', latencyMs: 2500, itemCount: null, errorSummary: 'Upstream unavailable' }
          ]
        }
      } });
    }
    if (path === '/api/users/admin' && requestUrl.searchParams.get('role') === 'STAFF') {
      return route.fulfill({ json: {
        ...emptyPage,
        content: [{ id: 9101, email: 'staff.one@local.test', fullName: 'Staff One', accountStatus: 'ACTIVE' }],
        totalElements: 1, numberOfElements: 1, empty: false
      } });
    }
    if (path === '/api/support/tickets') {
      return route.fulfill({ json: {
        ...emptyPage,
        content: [{
          id: 'ticket-assigned', category: 'TECHNICAL', subject: 'Ticket đã phân công', status: 'ASSIGNED',
          creatorId: 7001, creatorName: 'Student Fixture', creatorRole: 'STUDENT',
          assigneeId: 9101, assigneeName: 'Staff One', escalatedAt: null,
          createdAt: '2026-11-18T08:30:00Z', updatedAt: '2026-11-18T08:45:00Z', version: 1
        }],
        totalElements: 1, numberOfElements: 1, empty: false
      } });
    }
    if (path === '/api/support/tickets/ticket-assigned') {
      return route.fulfill({ json: {
        summary: {
          id: 'ticket-assigned', category: 'TECHNICAL', subject: 'Ticket đã phân công', status: 'ASSIGNED',
          creatorId: 7001, creatorName: 'Student Fixture', creatorRole: 'STUDENT',
          assigneeId: 9101, assigneeName: 'Staff One', escalatedAt: null,
          createdAt: '2026-11-18T08:30:00Z', updatedAt: '2026-11-18T08:45:00Z', version: 1
        },
        description: 'Fixture acceptance M4', messages: [], history: []
      } });
    }
    if (path === '/api/contracts/terminations/refunds') return route.fulfill({ json: [] });
    if (path === '/api/chat/conversations') return route.fulfill({ json: [] });
    if (path.includes('/financial-overview')) return route.fulfill({ json: {
      totalEscrowFundedUsdc: 0,
      totalTutorPaidUsdc: 0,
      totalPlatformFeeUsdc: 0,
      totalStudentRefundedUsdc: 0,
      totalSessionRefundedUsdc: 0,
      totalTerminationRefundedUsdc: 0,
      totalEscrowLockedUsdc: 0,
      totalActiveAgreements: 0,
      totalSettledSessions: 0,
      totalPendingSessions: 0,
      totalDisputedSessions: 0,
      totalCompletedTerminationItems: 0,
      platformWallet: null,
      escrowContractAddress: null,
      chainId: null
    } });
    return route.fulfill({ json: emptyPage });
  });
  return state;
}

test('E2E-01 Staff valid deep-link opens the requested tab', async ({ page }) => {
  await mockPortal(page);
  await page.goto('/dashboard?tab=community-moderation');
  await expect(page).toHaveURL(/tab=community-moderation/);
});

test('E2E-02 Staff admin-only deep-link is replaced by the Staff default', async ({ page }) => {
  await mockPortal(page);
  await page.goto('/dashboard?tab=admin-finance');
  await expect(page).toHaveURL(/tab=tutor-approval/);
  await expect(page).not.toHaveURL(/admin-finance/);
});

test('E2E-03 browser back and forward cannot preserve an Admin-only tab', async ({ page }) => {
  await mockPortal(page);
  await page.goto('/dashboard?tab=reports');
  await expect(page).toHaveURL(/tab=reports/);
  await page.goto('/dashboard?tab=admin-finance');
  await expect(page).toHaveURL(/tab=tutor-approval/);
  await page.goBack();
  await expect(page).toHaveURL(/tab=reports/);
  await page.goForward();
  await expect(page).toHaveURL(/tab=tutor-approval/);
});

test('SIDEBAR-01 Admin overview starts collapsed and accordion keeps only one group open', async ({ page }) => {
  test.setTimeout(60_000);
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');

  const groups = page.locator('aside button[data-admin-group]');
  await expect(groups).toHaveCount(5, { timeout: 20_000 });
  const overview = page.getByRole('link', { name: 'Tổng quan giám sát', exact: true });
  const typography = await page.locator('aside').evaluate((sidebar) => {
    const overviewLink = sidebar.querySelector('a[aria-current="page"]');
    const firstGroup = sidebar.querySelector('button[data-admin-group]');
    const overviewLabel = overviewLink?.querySelector('span');
    const groupLabel = firstGroup?.querySelector('span');
    if (!overviewLink || !firstGroup || !overviewLabel || !groupLabel) return null;
    const overviewStyle = getComputedStyle(overviewLabel);
    const groupStyle = getComputedStyle(groupLabel);
    return {
      overview: [overviewStyle.fontSize, overviewStyle.lineHeight, overviewStyle.letterSpacing],
      group: [groupStyle.fontSize, groupStyle.lineHeight, groupStyle.letterSpacing],
      iconDelta: Math.abs(
        overviewLink.querySelector('svg').getBoundingClientRect().left
        - firstGroup.querySelector('svg').getBoundingClientRect().left
      ),
      labelDelta: Math.abs(overviewLabel.getBoundingClientRect().left - groupLabel.getBoundingClientRect().left),
      labelFits: overviewLabel.scrollWidth <= overviewLabel.clientWidth,
    };
  });
  expect(typography).not.toBeNull();
  expect(typography.overview).toEqual(typography.group);
  expect(typography.iconDelta).toBeLessThanOrEqual(1);
  expect(typography.labelDelta).toBeLessThanOrEqual(1);
  expect(typography.labelFits).toBe(true);
  await expect(overview).toHaveClass(/bg-brand-text/);
  await expect(overview).toHaveClass(/text-white/);
  await expect(overview.locator('span.rounded-full')).toHaveCount(1);
  for (const group of await groups.all()) {
    await expect(group).toHaveAttribute('aria-expanded', 'false');
  }

  const users = page.locator('button[data-admin-group="users-academics"]');
  const finance = page.locator('button[data-admin-group="finance-contracts"]');
  await users.click();
  await expect(users).toHaveAttribute('aria-expanded', 'true');
  await finance.click();
  await expect(users).toHaveAttribute('aria-expanded', 'false');
  await expect(finance).toHaveAttribute('aria-expanded', 'true');
});

test('SIDEBAR-02 Admin child links cover all groups and history opens the exact containing group', async ({ page }) => {
  test.setTimeout(90_000);
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');

  const destinations = [
    ['users-academics', 'Quản lý người dùng', 'user-management'],
    ['finance-contracts', 'Tài chính & dòng tiền', 'admin-finance'],
    ['moderation-disputes', 'Kiểm duyệt cộng đồng', 'community-moderation'],
    ['operations', 'Điều phối lịch trực', 'staff-duty-management'],
    ['ai-system', 'Tri thức AI Chatbot', 'chatbot-knowledge'],
  ];

  for (const [groupId, label, tab] of destinations) {
    const group = page.locator(`button[data-admin-group="${groupId}"]`);
    if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  await page.goBack();
  await expect(page).toHaveURL(/tab=staff-duty-management/);
  await expect(page.locator('button[data-admin-group="operations"]')).toHaveAttribute('aria-expanded', 'true');
  await page.goForward();
  await expect(page).toHaveURL(/tab=chatbot-knowledge/);
  await expect(page.locator('button[data-admin-group="ai-system"]')).toHaveAttribute('aria-expanded', 'true');

  const activeGroup = page.locator('button[data-admin-group="ai-system"]');
  await activeGroup.click();
  await expect(activeGroup).toHaveAttribute('aria-expanded', 'false');
  await expect(activeGroup.locator('xpath=..')).toHaveAttribute('data-contains-active', 'true');
  await page.reload();
  await expect(activeGroup).toHaveAttribute('aria-expanded', 'true');
});

test('SIDEBAR-03 Staff keeps the original flat menu without Admin groups', async ({ page }) => {
  await mockPortal(page, { role: 'STAFF' });
  await page.goto('/dashboard?tab=tutor-approval');

  await expect(page.locator('aside button[data-admin-group]')).toHaveCount(0);
  for (const label of [
    'Tổng quan', 'Duyệt hồ sơ gia sư', 'Lớp / nội dung', 'Hợp đồng & Theo dõi',
    'Quản lý khiếu nại', 'Chuyển cấp Admin', 'Kiểm duyệt Community', 'Lịch trực của tôi'
  ]) {
    await expect(page.locator('aside').getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('SIDEBAR-04 mobile drawer keeps fixed actions visible while grouped menu scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await page.getByTitle('Mở menu').click();
  await page.locator('button[data-admin-group="users-academics"]').click();

  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  const overviewLabel = sidebar.getByRole('link', { name: 'Tổng quan giám sát', exact: true }).locator('span').first();
  expect(await overviewLabel.evaluate((label) => label.scrollWidth <= label.clientWidth)).toBe(true);
  await expect(sidebar.getByRole('button', { name: 'Trang chủ tra cứu', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Trợ giúp', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();

  const footerBox = await sidebar.getByRole('button', { name: 'Đăng xuất', exact: true }).boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(600);
});

test('TUTOR-SIDEBAR-01 overview starts collapsed, typography aligns, and only one group opens', async ({ page }) => {
  test.setTimeout(60_000);
  await mockPortal(page, { role: 'TUTOR' });
  await page.goto('/dashboard?tab=dashboard');

  const groups = page.locator('aside button[data-tutor-group]');
  await expect(groups).toHaveCount(2, { timeout: 20_000 });
  for (const group of await groups.all()) {
    await expect(group).toHaveAttribute('aria-expanded', 'false');
  }

  const overview = page.locator('a[data-tutor-item="dashboard"]');
  const typography = await page.locator('aside').evaluate((sidebar) => {
    const overviewLink = sidebar.querySelector('a[data-tutor-item="dashboard"]');
    const groupButton = sidebar.querySelector('button[data-tutor-group="teaching"]');
    const overviewLabel = overviewLink?.querySelector('span');
    const groupLabel = groupButton?.querySelector('span');
    if (!overviewLink || !groupButton || !overviewLabel || !groupLabel) return null;
    const overviewStyle = getComputedStyle(overviewLabel);
    const groupStyle = getComputedStyle(groupLabel);
    return {
      overview: [overviewStyle.fontSize, overviewStyle.lineHeight, overviewStyle.letterSpacing],
      group: [groupStyle.fontSize, groupStyle.lineHeight, groupStyle.letterSpacing],
      iconDelta: Math.abs(overviewLink.querySelector('svg').getBoundingClientRect().left - groupButton.querySelector('svg').getBoundingClientRect().left),
      labelDelta: Math.abs(overviewLabel.getBoundingClientRect().left - groupLabel.getBoundingClientRect().left),
      labelFits: overviewLabel.scrollWidth <= overviewLabel.clientWidth,
    };
  });
  expect(typography).not.toBeNull();
  expect(typography.overview).toEqual(typography.group);
  expect(typography.iconDelta).toBeLessThanOrEqual(1);
  expect(typography.labelDelta).toBeLessThanOrEqual(1);
  expect(typography.labelFits).toBe(true);
  await expect(overview).toHaveClass(/bg-brand-secondary/);
  await expect(overview).toHaveClass(/text-white/);
  await expect(overview.locator('span.rounded-full')).toHaveCount(1);

  const teaching = page.locator('button[data-tutor-group="teaching"]');
  const payments = page.locator('button[data-tutor-group="contracts-payments"]');
  await teaching.click();
  await expect(teaching).toHaveAttribute('aria-expanded', 'true');
  await payments.click();
  await expect(teaching).toHaveAttribute('aria-expanded', 'false');
  await expect(payments).toHaveAttribute('aria-expanded', 'true');
});

test('TUTOR-SIDEBAR-02 deep links, reload, history, and standalone routes preserve exact navigation', async ({ page }) => {
  test.setTimeout(90_000);
  await mockPortal(page, { role: 'TUTOR' });
  await page.goto('/dashboard?tab=homework');

  const teaching = page.locator('button[data-tutor-group="teaching"]');
  const payments = page.locator('button[data-tutor-group="contracts-payments"]');
  await expect(teaching).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('a[data-tutor-item="homework"]')).toHaveAttribute('aria-current', 'page');
  await expect(payments).toHaveAttribute('aria-expanded', 'false');

  await page.reload();
  await expect(teaching).toHaveAttribute('aria-expanded', 'true');
  await teaching.click();
  await expect(teaching).toHaveAttribute('aria-expanded', 'false');
  await expect(teaching.locator('xpath=..')).toHaveAttribute('data-contains-active', 'true');

  await payments.click();
  await page.locator('a[data-tutor-item="wallet"]').click();
  await expect(page).toHaveURL(/tab=wallet/);
  await expect(payments).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('a[data-tutor-item="wallet"]')).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page).toHaveURL(/tab=homework/);
  await expect(teaching).toHaveAttribute('aria-expanded', 'true');
  await page.goForward();
  await expect(page).toHaveURL(/tab=wallet/);
  await expect(payments).toHaveAttribute('aria-expanded', 'true');

  for (const [id, tab] of [['schedule', 'schedule'], ['requests', 'requests'], ['messages', 'messages']]) {
    await page.locator(`a[data-tutor-item="${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await expect(page.locator(`a[data-tutor-item="${id}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(teaching).toHaveAttribute('aria-expanded', 'false');
    await expect(payments).toHaveAttribute('aria-expanded', 'false');
  }
});

test('TUTOR-SIDEBAR-03 mobile drawer keeps labels readable and footer outside the scroll area', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 600 });
  await mockPortal(page, { role: 'TUTOR' });
  await page.goto('/dashboard?tab=dashboard');
  await page.getByTitle('Mở menu').click();
  await page.locator('button[data-tutor-group="teaching"]').click();

  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  const labelsFit = await sidebar.evaluate((element) =>
    [...element.querySelectorAll('[data-tutor-item] span:first-of-type, [data-tutor-group] span:first-of-type')]
      .every((label) => label.scrollWidth <= label.clientWidth)
  );
  expect(labelsFit).toBe(true);
  for (const label of ['Tài khoản', 'Trợ giúp', 'Đăng xuất']) {
    await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  const logoutBox = await sidebar.getByRole('button', { name: 'Đăng xuất', exact: true }).boundingBox();
  expect(logoutBox).not.toBeNull();
  expect(logoutBox.y + logoutBox.height).toBeLessThanOrEqual(600);
});

test('E2E-04 logout then Back does not restore protected Portal content', async ({ page }) => {
  await mockPortal(page);
  await page.goto('/dashboard?tab=reports');
  await page.locator('aside button').last().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/dashboard/);
  await expect(page.locator('aside')).toHaveCount(0);
  await page.goto('/dashboard?tab=reports');
  await expect(page).toHaveURL(/\/login/);
});

test('E2E-06/07/08 duty transition refreshes an open Staff tab fail-closed', async ({ page }) => {
  const state = await mockPortal(page, { duty: 'ON_DUTY' });
  await page.goto('/dashboard?tab=community-moderation');
  await expect(page.getByTestId('staff-duty-read-only-banner')).toHaveCount(0);
  state.duty = 'OFF_DUTY';
  await page.evaluate(() => window.dispatchEvent(new Event('staff-duty:changed')));
  await expect(page.getByTestId('staff-duty-read-only-banner')).toBeVisible();
  state.duty = 'ON_DUTY';
  await page.evaluate(() => window.dispatchEvent(new Event('staff-duty:changed')));
  await expect(page.getByTestId('staff-duty-read-only-banner')).toHaveCount(0);
});

test('E2E-11 Admin opens an inherited Staff tab and the SLA summary', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=community-moderation');
  await expect(page).toHaveURL(/tab=community-moderation/);
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('admin-sla-summary')).toBeVisible();
});

test('M4-01 Admin dashboard exposes source health and current workload', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('admin-source-health')).toBeVisible();
  await expect(page.getByTestId('admin-source-health')).toContainText('ACCOUNT_SUPPORT');
  await expect(page.getByTestId('admin-source-health')).toContainText('UNAVAILABLE');
  await expect(page.getByTestId('admin-workload')).toContainText('staff.one@local.test');
});

test('M4-02 Staff Action Center distinguishes shared/assigned work and server SLA', async ({ page }) => {
  await mockPortal(page, { role: 'STAFF', duty: 'ON_DUTY' });
  await page.goto('/dashboard?tab=dashboard');
  const center = page.getByTestId('staff-action-center');
  await expect(center).toBeVisible();
  await expect(center).toContainText('Ticket hàng đợi chung');
  await expect(center).toContainText('Ticket đã phân công');
  await expect(center).toContainText('Quá hạn 15 phút');
  await expect(center).toContainText('Sắp đến hạn · còn 20 phút');
});

test('M4-03 Admin Help Desk exposes reassignment without desktop-only dependency', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=help');
  await page.getByRole('button', { name: /Ticket đã phân công/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Chọn Staff phụ trách')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phân công lại' })).toBeVisible();
});

test('M4-04 Admin dashboard remains usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('admin-sla-summary')).toBeVisible();
  await expect(page.getByTestId('admin-source-health')).toBeVisible();
  await expect(page.getByTestId('admin-workload')).toBeVisible();
  const bodyWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(410);
});

test('M6-01 Admin dashboard renders all four analytics charts and survives refresh', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('chart-work-items')).toBeVisible();
  await expect(page.getByTestId('chart-work-items')).toContainText('Công việc cần xử lý theo chức năng');
  await expect(page.getByTestId('chart-sla')).toBeVisible();
  await expect(page.getByTestId('chart-sla')).toContainText('Tình trạng xử lý công việc');
  await expect(page.getByTestId('chart-staff-workload')).toBeVisible();
  await expect(page.getByTestId('chart-staff-workload')).toContainText('Khối lượng công việc của nhân viên');
  await expect(page.getByTestId('chart-financial')).toBeVisible();
  await expect(page.getByTestId('chart-financial')).toContainText('Tình hình tài chính theo thời gian');
  await page.reload();
  await expect(page.getByTestId('chart-financial')).toBeVisible();
});

test('M6-02 Contract unavailable degrades only the financial chart', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN', contractAvailable: false });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('chart-financial')).toContainText('tạm thời không khả dụng');
  await expect(page.getByTestId('chart-work-items')).not.toContainText('tạm thời không khả dụng');
  await expect(page.getByTestId('chart-sla')).not.toContainText('tạm thời không khả dụng');
  await expect(page.getByTestId('chart-staff-workload')).not.toContainText('tạm thời không khả dụng');
});

test('M6-03 financial range reloads the dashboard with a supported period', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await page.getByTestId('financial-range').selectOption('90');
  await expect(page.getByTestId('financial-range')).toHaveValue('90');
  await expect(page.getByTestId('chart-financial')).toContainText('Đơn vị: USDC');
});

test('M6-04 analytics dashboard remains bounded on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPortal(page, { role: 'ADMIN' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('admin-analytics-dashboard')).toBeVisible();
  const bodyWidth = await page.locator('body').evaluate(element => element.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(410);
});

test('M6-05 Staff cannot render Admin-only analytics', async ({ page }) => {
  await mockPortal(page, { role: 'STAFF' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('admin-analytics-dashboard')).toHaveCount(0);
});

test('M6-06 analytics charts expose meaningful empty states', async ({ page }) => {
  await mockPortal(page, { role: 'ADMIN', emptyAnalytics: true });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('chart-work-items')).toContainText('Chưa có dữ liệu');
  await expect(page.getByTestId('chart-sla')).toContainText('Chưa có dữ liệu');
  await expect(page.getByTestId('chart-staff-workload')).toContainText('Chưa có dữ liệu');
  await expect(page.getByTestId('chart-financial')).toContainText('Chưa có dữ liệu');
});

test('M6-07 analytics charts expose loading state', async ({ page }) => {
  const state = await mockPortal(page, { role: 'ADMIN', analyticsPending: true });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('chart-work-items-loading')).toBeVisible();
  state.releaseAnalytics();
  await expect(page.getByTestId('chart-financial')).toBeVisible();
});

test('M5-01 Tutor dashboard renders populated teaching, income and review data', async ({ page }) => {
  await mockPortal(page, { role: 'TUTOR' });
  await page.goto('/dashboard?tab=dashboard');
  const dashboard = page.getByTestId('tutor-statistics-dashboard');
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toContainText('Toán 11 nâng cao');
  await expect(dashboard).toContainText('25,6 USDC');
  await expect(dashboard).toContainText('4.8 · 5 lượt');
  await expect(dashboard).toContainText('Bài chờ chấm');
});

test('M5-02 Contract failure leaves Tutor teaching data visible without fake zero income', async ({ page }) => {
  await mockPortal(page, { role: 'TUTOR', contractAvailable: false });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('tutor-statistics-partial')).toContainText('CONTRACT');
  await expect(page.getByTestId('tutor-statistics-dashboard')).toContainText('Toán 11 nâng cao');
  await expect(page.getByText('Không khả dụng', { exact: true })).toBeVisible();
  await expect(page.getByText(/Contract Service chưa khả dụng/)).toBeVisible();
});

test('M5-03 Tutor statistics remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPortal(page, { role: 'TUTOR' });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByTestId('tutor-statistics-dashboard')).toBeVisible();
  await expect(page.getByLabel('Khoảng thời gian thống kê')).toBeVisible();
  const bodyWidth = await page.locator('body').evaluate(element => element.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(410);
});

test('M5-04 Tutor dashboard exposes meaningful empty states', async ({ page }) => {
  await mockPortal(page, { role: 'TUTOR', emptyStatistics: true });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByText('Chưa có lớp học để thống kê.')).toBeVisible();
  await expect(page.getByText('Chưa có settlement tài chính cho gia sư này.')).toBeVisible();
  await expect(page.getByText('Không khả dụng', { exact: true })).toHaveCount(0);
});

test('M5-05 Tutor dashboard renders a loading skeleton before data', async ({ page }) => {
  await mockPortal(page, { role: 'TUTOR', statisticsDelayMs: 1000 });
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.getByLabel('Đang tải').first()).toBeVisible();
  await expect(page.getByTestId('tutor-statistics-dashboard')).toContainText('Toán 11 nâng cao');
});
