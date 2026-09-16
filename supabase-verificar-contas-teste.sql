select u.email, p.name, p.department, p.level, u.raw_user_meta_data
from auth.users u
join profiles p on p.id = u.id
where u.email in ('admincomercial@gmail.com', 'staffcomercial@gmail.com');
