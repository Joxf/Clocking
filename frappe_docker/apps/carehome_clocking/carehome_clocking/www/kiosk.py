no_cache = 1
no_sitemap = 1

def get_context(context):
    context.no_cache = 1
    context.show_sidebar = False
    context.no_header = True
    return context
