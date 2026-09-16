-- Força department/level corretos nas duas contas de teste do comercial,
-- independente do que o gatilho tenha gravado no cadastro.

update profiles set department = 'comercial', level = 'admin'
where id = (select id from auth.users where email = 'admincomercial@gmail.com');

update profiles set department = 'comercial', level = 'staff'
where id = (select id from auth.users where email = 'staffcomercial@gmail.com');

-- Confere o resultado:
select u.email, p.name, p.department, p.level
from auth.users u join profiles p on p.id = u.id
where u.email in ('admincomercial@gmail.com', 'staffcomercial@gmail.com');
