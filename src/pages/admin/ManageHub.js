import { pageRoot } from '../../store.js';
import { escapeHtml } from '../../lib/html.js';

export function mountManageHub() {
  const root = pageRoot();
  const items = [
    {
      href: '#/students',
      tag: 'HỌC SINH',
      title: 'Theo dõi & Quản lý Học sinh',
      description: 'Theo dõi tiến độ bài giảng, xem bảng điểm, trạng thái online và quản lý tài khoản.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    },
    {
      href: '#/content',
      tag: 'KHÓA HỌC',
      title: 'Quản lý Nội dung khóa học',
      description: 'Cấu trúc các giai đoạn, chương, bài học và danh sách bài giảng.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    },
    {
      href: '#/assignments',
      tag: 'ĐỀ THI & BÀI TẬP',
      title: 'Quản lý Đề thi & Bài tập',
      description: 'Tạo bài tập, cài đặt đáp án, phiếu trả lời và chấm bài.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
    },
    {
      href: '#/salary',
      tag: 'LƯƠNG & LỊCH',
      title: 'Lịch dạy & Lương',
      description: 'Cập nhật điểm danh lịch dạy và tổng hợp thu nhập trợ giảng.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    },
    {
      href: '#/question-bank',
      tag: 'NGÂN HÀNG',
      title: 'Ngân hàng đề',
      description: 'Quản lý kho câu hỏi, tìm kiếm và phân loại câu hỏi để sử dụng cho các bài tập.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    },
  ];

  root.innerHTML = `
    <style>
      .nh-hub-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #D8E2C4;
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        text-decoration: none;
        color: inherit;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
        cursor: pointer;
      }
      .nh-hub-card:hover {
        box-shadow: 0 8px 24px rgba(69, 81, 32, 0.09);
        border-color: #455120;
        transform: translateY(-2px);
      }
      .nh-hub-icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #F0F4E8;
        border: 1px solid #D8E2CA;
        color: #455120;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .nh-hub-card:hover .nh-hub-icon-wrapper {
        background: #455120;
        color: #ffffff;
        border-color: #455120;
      }
      .nh-hub-arrow-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #F0F4E8;
        border: 1px solid #D8E2CA;
        color: #455120;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .nh-hub-card:hover .nh-hub-arrow-btn {
        background: #455120;
        color: #ffffff;
        border-color: #455120;
        transform: translateX(4px);
      }
    </style>

    <div style="min-height: calc(100vh - 64px); background: #EDF2E4; padding: 0 0 60px 0; font-family: 'Be Vietnam Pro', sans-serif;">
      
      <!-- Top Breadcrumb Bar -->
      <div class="nh-admin-breadcrumb-bar" style="margin-bottom: 24px;">
        <div class="nh-admin-breadcrumb-inner" style="max-width: 1000px;">
          <a href="#/learn">Trang chủ</a>
          <span class="sep">&rsaquo;</span>
          <span class="active">Trung tâm Quản trị</span>
        </div>
      </div>

      <div style="max-width: 1000px; margin: 0 auto; padding: 0 max(var(--page-gutter), 24px); display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Header Card -->
        <div style="background: #ffffff; border-radius: 14px; border: 1px solid #D8E2C4; padding: 16px 24px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02); display: flex; align-items: center; justify-content: space-between;">
          <h1 style="font-family: 'Beautique Display', serif; font-size: 22px; font-weight: 700; color: #455120; margin: 0;">Trung tâm Quản trị</h1>
        </div>

        <!-- Cards grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 20px;">
          ${items.map(item => `
            <a href="${item.href}" class="nh-hub-card">
              <div style="display: flex; align-items: center; gap: 18px; min-width: 0; flex: 1;">
                <div class="nh-hub-icon-wrapper">
                  ${item.icon}
                </div>
                <div style="min-width: 0; flex: 1;">
                  <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">${escapeHtml(item.title)}</h3>
                </div>
              </div>
              <div class="nh-hub-arrow-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
