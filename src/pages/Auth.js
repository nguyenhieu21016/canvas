import { state, isManager, pageRoot, render } from '../main.js';
import { toast } from '../lib/ui.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { setButtonLoading } from '../lib/html.js';
import { requestPasswordReset, updateCurrentUserPassword, getCurrentProfile, getSession, signIn, signUpStudent } from '../services/lmsApi.js';

function renderAuth() {
  const isReset = state.authMode === 'reset';
  const isUpdatePassword = state.authMode === 'updatePassword';
  const primaryLabel = isUpdatePassword
    ? 'Cập nhật mật khẩu'
    : isReset
      ? 'Gửi link đặt lại'
      : state.authMode === 'login'
        ? 'Đăng nhập'
        : 'Tạo tài khoản học sinh';
  const primaryIcon = isUpdatePassword ? 'lock_reset' : isReset ? 'mail' : state.authMode === 'login' ? 'login' : 'person_add';
  document.querySelector('#app').innerHTML = `
    <main class="auth-screen">
      <section class="auth-panel">
        <!-- Left Brand Banner -->
        <div class="auth-copy">
          <div class="auth-copy-inner">
            <div class="auth-logo">
              <img src="/logo.png" alt="Canvas Logo" style="width: 40px; height: 40px; border-radius: 10px; object-fit: contain;" />
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span class="auth-eyebrow">HƯỚNG TỚI KÌ THI THPTQG 2027</span>
              <h1 class="auth-brand-name">CANVAS</h1>
            </div>
          </div>
        </div>

        <!-- Right Form Panel -->
        <form id="auth-form" class="auth-form">
          ${
            isUpdatePassword || isReset
              ? `
                <div class="auth-form-heading">
                  <p class="eyebrow" style="font-family: 'Be Vietnam Pro', sans-serif; color: #455120; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; margin: 0 0 4px 0;">Khôi phục tài khoản</p>
                  <h2 style="font-family: 'Beautique Display', serif; font-size: 24px; font-weight: 700; color: #1e293b; margin: 0;">${isReset ? 'Đặt lại mật khẩu' : 'Tạo mật khẩu mới'}</h2>
                  <p class="muted" style="font-size: 13px; color: #64748b; margin: 6px 0 0 0; line-height: 1.5;">${isReset ? 'Nhập email tài khoản, hệ thống sẽ gửi link đặt lại mật khẩu.' : 'Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.'}</p>
                </div>
              `
              : `
                <div>
                  <h2 class="auth-form-title">${state.authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
                </div>
                <div class="segmented" role="tablist" aria-label="Chọn chế độ đăng nhập">
                  <button type="button" role="tab" aria-selected="${state.authMode === 'login'}" aria-pressed="${state.authMode === 'login'}" data-mode="login" class="${state.authMode === 'login' ? 'selected' : ''}">Đăng nhập</button>
                  <button type="button" role="tab" aria-selected="${state.authMode === 'register'}" aria-pressed="${state.authMode === 'register'}" data-mode="register" class="${state.authMode === 'register' ? 'selected' : ''}">Đăng ký</button>
                </div>
              `
          }
          ${!hasSupabaseConfig ? '<div class="notice" style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 10px; font-size: 13px;">Cần cấu hình Supabase trong .env để đăng nhập và lưu dữ liệu.</div>' : ''}
          
          <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 4px;">
            ${
              state.authMode === 'register'
                ? `
                  <div class="auth-field-group">
                    <label class="auth-field-label">Họ tên</label>
                    <input type="text" name="full_name" class="auth-input-field" placeholder="Nhập họ và tên" autocomplete="name" required />
                  </div>
                `
                : ''
            }
            ${
              isUpdatePassword
                ? ''
                : `
                  <div class="auth-field-group">
                    <label class="auth-field-label">Email</label>
                    <input type="email" name="email" class="auth-input-field" placeholder="nhapemail@gmail.com" autocomplete="email" required />
                  </div>
                `
            }
            ${
              isReset
                ? ''
                : `
                  <div class="auth-field-group">
                    <label class="auth-field-label">${isUpdatePassword ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
                    <input type="password" name="password" class="auth-input-field" placeholder="••••••••" autocomplete="${isUpdatePassword || state.authMode === 'register' ? 'new-password' : 'current-password'}" required />
                  </div>
                `
            }
            ${
              isUpdatePassword
                ? `
                  <div class="auth-field-group">
                    <label class="auth-field-label">Nhập lại mật khẩu mới</label>
                    <input type="password" name="confirm_password" class="auth-input-field" placeholder="••••••••" autocomplete="new-password" required />
                  </div>
                `
                : ''
            }
          </div>

          <button type="submit" class="auth-submit-btn" ${!hasSupabaseConfig ? 'disabled' : ''}>
            <span>${primaryLabel}</span>
          </button>

          <div class="auth-secondary-actions">
            ${
              state.authMode === 'login'
                ? '<button class="text-link" type="button" data-mode="reset">Quên mật khẩu?</button>'
                : ''
            }
            ${
              isReset
                ? '<button class="text-link" type="button" data-mode="login">Quay lại đăng nhập</button>'
                : ''
            }
          </div>
        </form>
      </section>
    </main>
  `;

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.mode;
      renderAuth();
    });
  });

  document.querySelector('#auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!hasSupabaseConfig) return;
    const form = event.currentTarget;
    const restore = setButtonLoading(form.querySelector('md-filled-button'));

    try {
      const email = form.querySelector('[name="email"]')?.value.trim() ?? '';
      const password = form.querySelector('[name="password"]')?.value;
      if (state.authMode === 'reset') {
        await requestPasswordReset(email);
        state.authMode = 'login';
        toast('Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư của bạn nhé.', 'success');
        renderAuth();
        return;
      }
      if (state.authMode === 'updatePassword') {
        const confirmPassword = form.querySelector('[name="confirm_password"]').value;
        if (password !== confirmPassword) throw new Error('Hai mật khẩu chưa khớp.');
        await updateCurrentUserPassword(password);
        state.passwordRecovery = false;
        toast('Đã cập nhật mật khẩu. Bạn có thể tiếp tục học.', 'success');
        state.profile = await getCurrentProfile(state.session?.user);
        render();
        return;
      }
      if (state.authMode === 'login') {
        state.session = await signIn(email, password);
        state.profile = await getCurrentProfile(state.session?.user);
      } else {
        const fullName = form.querySelector('[name="full_name"]').value.trim();
        const signup = await signUpStudent({ email, password, fullName });
        state.session = signup.session ?? (await getSession());
        if (!state.session) {
          state.authMode = 'login';
          toast('Tài khoản đã tạo. Vui lòng xác nhận email rồi đăng nhập.', 'success');
          renderAuth();
          return;
        }
        state.profile = await getCurrentProfile(state.session.user);
      }
      render();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });
}
export { renderAuth };
