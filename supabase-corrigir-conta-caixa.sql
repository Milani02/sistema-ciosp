update profiles set department = 'caixa', level = 'staff', name = 'Caixa'
where id = (select id from auth.users where email = 'caixa@gmail.com');

select u.email, p.name, p.department, p.level
from auth.users u join profiles p on p.id = u.id
where u.email = 'caixa@gmail.com';
