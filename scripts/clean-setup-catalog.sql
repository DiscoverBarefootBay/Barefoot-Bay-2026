-- Read-only catalog query. No application rows, sequence counters, comments,
-- ownership, grants, connection strings or service credentials are selected.
WITH app_tables AS (
  SELECT c.*, n.nspname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname !~* '(^|_)(backup|recovery)(_|$)'
), sequences AS (
  SELECT c.relname, s.*, a.attname AS owner_column, owner.relname AS owner_table,
    d.deptype, owner_ns.nspname AS owner_schema
  FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_depend d ON d.objid=c.oid AND d.classid='pg_class'::regclass
    AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
  LEFT JOIN pg_class owner ON owner.oid=d.refobjid
  LEFT JOIN pg_namespace owner_ns ON owner_ns.oid=owner.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
  WHERE n.nspname='public'
    AND (owner.oid IS NULL OR owner.oid IN (SELECT oid FROM app_tables))
)
SELECT json_build_object(
  'format',1,
  'source','development-public-schema',
  'serverVersion',current_setting('server_version'),
  'unsupported',json_build_object(
    'partitions',(SELECT count(*) FROM app_tables WHERE relkind='p' OR relispartition),
    'inheritance',(SELECT count(*) FROM pg_inherits WHERE inhrelid IN (SELECT oid FROM app_tables)),
    'foreignTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='f'),
    'composites',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='c'),
    'domains',(SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='d'),
    'rules',(SELECT count(*) FROM pg_rewrite WHERE ev_class IN (SELECT oid FROM app_tables) AND rulename<>'_RETURN'),
    'collations',(SELECT count(*) FROM pg_collation co JOIN pg_namespace n ON n.oid=co.collnamespace WHERE n.nspname='public'),
    'procedures',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind<>'f'),
    'nonPublicExtensions',(SELECT count(*) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname NOT IN ('public','pg_catalog'))
  ),
  'extensions',COALESCE((SELECT json_agg(json_build_object('name',e.extname,'schema',n.nspname) ORDER BY e.extname)
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname<>'plpgsql'),'[]'::json),
  'enums',COALESCE((SELECT json_agg(json_build_object('name',t.typname,'labels',
    (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)) ORDER BY t.typname)
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'),'[]'::json),
  'sequences',COALESCE((SELECT json_agg(json_build_object(
    'name',relname,'type',format_type(seqtypid,NULL),'start',seqstart::text,
    'increment',seqincrement::text,'min',seqmin::text,'max',seqmax::text,
    'cache',seqcache::text,'cycle',seqcycle,'ownerTable',owner_table,
    'ownerColumn',owner_column,'ownerSchema',owner_schema,'identity',deptype='i'
  ) ORDER BY relname) FROM sequences),'[]'::json),
  'tables',COALESCE((SELECT json_agg(json_build_object(
    'name',c.relname,'unlogged',c.relpersistence='u','rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'columns',(SELECT json_agg(json_build_object('name',a.attname,
      'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'default',pg_get_expr(ad.adbin,ad.adrelid),'identity',a.attidentity,'generated',a.attgenerated,
      'collation',CASE WHEN a.attcollation<>t.typcollation THEN quote_ident(cn.nspname)||'.'||quote_ident(co.collname) ELSE NULL END
    ) ORDER BY a.attnum) FROM pg_attribute a
      JOIN pg_type t ON t.oid=a.atttypid
      LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
      LEFT JOIN pg_collation co ON co.oid=a.attcollation
      LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
  ) ORDER BY c.relname) FROM app_tables c),'[]'::json),
  'functions',COALESCE((SELECT json_agg(json_build_object('name',p.proname,'ddl',pg_get_functiondef(p.oid)) ORDER BY p.proname,p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),'[]'::json),
  'constraints',COALESCE((SELECT json_agg(json_build_object('table',c.relname,'name',con.conname,
    'type',con.contype,'ddl',pg_get_constraintdef(con.oid,true)) ORDER BY c.relname,con.conname)
    FROM pg_constraint con JOIN app_tables c ON c.oid=con.conrelid),'[]'::json),
  'indexes',COALESCE((SELECT json_agg(pg_get_indexdef(i.indexrelid) ORDER BY ic.relname)
    FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND (c.oid IN (SELECT oid FROM app_tables) OR c.relkind='m')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid=i.indexrelid AND con.contype IN ('p','u','x'))),'[]'::json),
  'views',COALESCE((SELECT json_agg(json_build_object('name',c.relname,'materialized',c.relkind='m','ddl',pg_get_viewdef(c.oid,true)) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')),'[]'::json),
  'triggers',COALESCE((SELECT json_agg(json_build_object('table',c.relname,'name',t.tgname,
    'enabled',t.tgenabled,'ddl',pg_get_triggerdef(t.oid,true)) ORDER BY c.relname,t.tgname)
    FROM pg_trigger t JOIN app_tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal),'[]'::json),
  'policies',COALESCE((SELECT json_agg(json_build_object('table',c.relname,'name',p.polname,
    'permissive',p.polpermissive,'command',p.polcmd,
    'roles',(SELECT json_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE (SELECT rolname FROM pg_roles WHERE oid=r) END) FROM unnest(p.polroles) r),
    'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)
  ) ORDER BY c.relname,p.polname) FROM pg_policy p JOIN app_tables c ON c.oid=p.polrelid),'[]'::json)
)::text AS catalog;
