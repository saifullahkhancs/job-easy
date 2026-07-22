from enum import Enum

class UserRole(Enum):
    ADMIN = "admin"
    VISITOR = "visitor"
    CUSTOMER = "customer"