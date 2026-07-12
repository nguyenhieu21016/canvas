import { state, isManager, pageRoot, toast, wireMaterialFormButtons, render } from '../main.js';
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
        <div class="auth-copy">
          <span class="auth-eyebrow">Hướng tới kì thi THPTQG 2027</span>
          <h1>Canvas</h1>
          <p>If you can get 1 percent better each day for one year, you’ll end up 37 times better by the time you’re done.</p>
        </div>
        <form id="auth-form" class="auth-form">
          ${
            isUpdatePassword || isReset
              ? `
                <div class="auth-form-heading">
                  <p class="eyebrow">Khôi phục tài khoản</p>
                  <h2>${isReset ? 'Đặt lại mật khẩu' : 'Tạo mật khẩu mới'}</h2>
                  <p class="muted">${isReset ? 'Nhập email tài khoản, hệ thống sẽ gửi link đặt lại mật khẩu.' : 'Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.'}</p>
                </div>
              `
              : `
                <div class="segmented" role="tablist" aria-label="Chọn chế độ đăng nhập">
                  <button type="button" role="tab" aria-selected="${state.authMode === 'login'}" aria-pressed="${state.authMode === 'login'}" data-mode="login" class="${state.authMode === 'login' ? 'selected' : ''}">Đăng nhập</button>
                  <button type="button" role="tab" aria-selected="${state.authMode === 'register'}" aria-pressed="${state.authMode === 'register'}" data-mode="register" class="${state.authMode === 'register' ? 'selected' : ''}">Đăng ký</button>
                </div>
              `
          }
          ${!hasSupabaseConfig ? '<div class="notice">Cần cấu hình Supabase trong .env để đăng nhập và lưu dữ liệu.</div>' : ''}
          ${
            state.authMode === 'register'
              ? '<md-outlined-text-field name="full_name" label="Họ tên" autocomplete="name" required></md-outlined-text-field>'
              : ''
          }
          ${
            isUpdatePassword
              ? ''
              : '<md-outlined-text-field name="email" label="Email" type="email" autocomplete="email" required></md-outlined-text-field>'
          }
          ${
            isReset
              ? ''
              : `<md-outlined-text-field name="password" label="${isUpdatePassword ? 'Mật khẩu mới' : 'Mật khẩu'}" type="password" autocomplete="${isUpdatePassword || state.authMode === 'register' ? 'new-password' : 'current-password'}" required></md-outlined-text-field>`
          }
          ${isUpdatePassword ? '<md-outlined-text-field name="confirm_password" label="Nhập lại mật khẩu mới" type="password" autocomplete="new-password" required></md-outlined-text-field>' : ''}
          <md-filled-button type="submit" ${!hasSupabaseConfig ? 'disabled' : ''}>
            <md-icon slot="icon">${primaryIcon}</md-icon>
            ${primaryLabel}
          </md-filled-button>
          <div class="auth-secondary-actions">
            ${
              state.authMode === 'login'
                ? '<button class="text-link" type="button" data-mode="reset">Quên mật khẩu?</button>'
                : ''
            }
            ${
              isReset
                ? '<button class="text-link" type="button" data-mode="login"><md-icon>arrow_back</md-icon>Quay lại đăng nhập</button>'
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
  wireMaterialFormButtons(document.querySelector('#auth-form'));

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
