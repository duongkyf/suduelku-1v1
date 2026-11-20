const AUTH_REQUIRED_IDS = ['btnQuickMatchCenter', 'btnHomeCreateRoom', 'btnToggleRoomInput', 'btnOpenHistoryModal'];
const $id = (id) => document.getElementById(id);

// Cập nhật giao diện theo trạng thái đăng nhập: chuyển đổi khu vực khách/thành viên, hiển thị tên cùng ELO và khóa hoặc mở các chức năng yêu cầu tài khoản
function updateAuthUI() {
  const loggedIn = dbState.isLoggedIn;
  $id('homeGuestActions').classList.toggle('hidden', loggedIn);
  $id('homeLoggedActions').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    $id('currentUsernameLabel').textContent = dbState.currentUser.username;
    $id('currentEloLabel').textContent = `${dbState.currentUser.elo} ELO`;
  } else {
    $id('historyModal').classList.add('hidden');
    $id('roomInputCollapse').classList.add('hidden');
  }

  // Các nút yêu cầu đăng nhập: khóa khi là Khách, mở khi đã đăng nhập
  AUTH_REQUIRED_IDS.forEach(id => {
    const btn = $id(id);
    if (!btn) return;
    btn.disabled = !loggedIn;
    btn.classList.toggle('opacity-50', !loggedIn);
    btn.classList.toggle('cursor-not-allowed', !loggedIn);
  });
  document.querySelectorAll('.auth-lock-icon').forEach(el => el.classList.toggle('hidden', loggedIn));
}


// Mở modal xác thực theo chế độ (Đăng nhập/Đăng ký), cập nhật tiêu đề, nút bấm, trạng thái tab tương ứng
function openAuthModalWithMode(mode = 'LOGIN') {
  dbState.authMode = mode;
  const isLogin = mode === 'LOGIN';
  const ON = 'py-1.5 text-xs font-bold bg-[#292524] text-[#fffdf9]';
  const OFF = 'py-1.5 text-xs font-bold text-[#1c1917]';

  // Luôn làm trống 2 ô nhập khi mở popup hoặc chuyển tab
  $id('authUsernameInput').value = '';
  $id('authPasswordInput').value = '';
  $id('authPasswordInput').autocomplete = isLogin ? 'current-password' : 'new-password';
  $id('authModalTitle').textContent = isLogin ? 'Đăng Nhập Tài Khoản' : 'Đăng Ký Tài Khoản Mới';
  $id('btnAuthSubmit').textContent = isLogin ? 'Đăng nhập ngay' : 'Tạo tài khoản & Đăng nhập';
  $id('tabSelectLogin').className = isLogin ? ON : OFF;
  $id('tabSelectRegister').className = isLogin ? OFF : ON;
  $id('authModal').classList.remove('hidden');
}